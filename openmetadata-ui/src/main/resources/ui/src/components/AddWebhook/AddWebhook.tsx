/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Store } from 'antd/lib/form/interface';
import classNames from 'classnames';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { cloneDeep, isEqual, isNil } from 'lodash';
import { EditorContentRef } from 'Models';
import React, { FunctionComponent, useCallback, useRef, useState } from 'react';
import { ROUTES, TERM_ALL } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/globalSettings.constants';
import {
  CONFIGURE_SLACK_TEXT,
  CONFIGURE_WEBHOOK_TEXT,
} from '../../constants/HelperTextUtil';
import { UrlEntityCharRegEx } from '../../constants/regex.constants';
import { FormSubmitType } from '../../enums/form.enum';
import { PageLayoutType } from '../../enums/layout.enum';
import {
  CreateWebhook,
  EventFilter,
  Filters,
} from '../../generated/api/events/createWebhook';
import { WebhookType } from '../../generated/entity/events/webhook';
import {
  errorMsg,
  getSeparator,
  isValidUrl,
  requiredField,
} from '../../utils/CommonUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import CopyToClipboardButton from '../buttons/CopyToClipboardButton/CopyToClipboardButton';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { AddWebhookProps } from './AddWebhook.interface';
import SelectComponent from './select-component';
import {
  EVENT_FILTERS_DEFAULT_VALUE,
  EVENT_FILTER_FORM_INITIAL_VALUE,
} from './WebhookConstants';

const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const getFormData = (eventFilters: EventFilter[]): Store => {
  if (eventFilters.length === 1 && eventFilters[0].entityType === TERM_ALL) {
    return EVENT_FILTER_FORM_INITIAL_VALUE;
  }

  const formEventFilters = {} as Store;

  eventFilters?.forEach((eventFilter) => {
    if (eventFilter.entityType === TERM_ALL) {
      return;
    }

    formEventFilters[eventFilter.entityType] = true;
    formEventFilters[`${eventFilter.entityType}-tree`] =
      eventFilter.filters?.map((filter) => filter.eventType) || [];
  });

  return formEventFilters;
};

const getEventFilters = (eventFilterFormData: Store): EventFilter[] => {
  if (isEqual(eventFilterFormData, EVENT_FILTER_FORM_INITIAL_VALUE)) {
    return [EVENT_FILTERS_DEFAULT_VALUE];
  }

  const newFilters = Object.entries(eventFilterFormData).reduce(
    (acc, [key, value]) => {
      if (key.includes('-tree')) {
        return acc;
      }
      if (value) {
        const selectedFilter = eventFilterFormData[`${key}-tree`] as string[];

        return [
          ...acc,
          {
            entityType: key,
            filters:
              selectedFilter[0] === TERM_ALL
                ? EVENT_FILTERS_DEFAULT_VALUE.filters
                : (selectedFilter.map((filter) => ({
                    eventType: filter,
                    fields: [TERM_ALL],
                  })) as Filters[]),
          },
        ];
      }

      return acc;
    },
    [] as EventFilter[]
  );

  return [EVENT_FILTERS_DEFAULT_VALUE, ...newFilters];
};

const AddWebhook: FunctionComponent<AddWebhookProps> = ({
  data,
  header,
  mode = FormSubmitType.ADD,
  saveState = 'initial',
  deleteState = 'initial',
  allowAccess = true,
  webhookType = WebhookType.Generic,
  onCancel,
  onDelete,
  onSave,
}: AddWebhookProps) => {
  const markdownRef = useRef<EditorContentRef>();
  const [eventFilterFormData, setEventFilterFormData] = useState<Store>(
    data?.eventFilters
      ? getFormData(data?.eventFilters)
      : EVENT_FILTER_FORM_INITIAL_VALUE
  );
  const [name, setName] = useState<string>(data?.name || '');
  const [endpointUrl, setEndpointUrl] = useState<string>(data?.endpoint || '');
  const [description] = useState<string>(data?.description || '');
  const [active, setActive] = useState<boolean>(
    !isNil(data?.enabled) ? Boolean(data?.enabled) : true
  );
  const [showAdv, setShowAdv] = useState<boolean>(false);

  const [secretKey, setSecretKey] = useState<string>(data?.secretKey || '');
  const [batchSize, setBatchSize] = useState<number | undefined>(
    data?.batchSize
  );
  const [connectionTimeout, setConnectionTimeout] = useState<
    number | undefined
  >(data?.timeout);
  const [showErrorMsg, setShowErrorMsg] = useState<{ [key: string]: boolean }>({
    name: false,
    endpointUrl: false,
    eventFilters: false,
    invalidName: false,
    invalidEndpointUrl: false,
    invalidEventFilters: false,
  });
  const [generatingSecret, setGeneratingSecret] = useState<boolean>(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);

  const handleDelete = () => {
    if (data) {
      onDelete && onDelete(data.id);
    }
    setIsDelete(false);
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (!allowAccess) {
      return;
    }
    const value = event.target.value;
    const eleName = event.target.name;
    let { name, endpointUrl, invalidEndpointUrl, invalidName } =
      cloneDeep(showErrorMsg);

    switch (eleName) {
      case 'name': {
        setName(value);
        name = false;
        invalidName = false;

        break;
      }
      case 'endpoint-url': {
        setEndpointUrl(value);
        endpointUrl = false;
        invalidEndpointUrl = false;

        break;
      }
      case 'batch-size': {
        setBatchSize(value as unknown as number);

        break;
      }
      case 'connection-timeout': {
        setConnectionTimeout(value as unknown as number);

        break;
      }
    }
    setShowErrorMsg((prev) => {
      return { ...prev, name, endpointUrl, invalidEndpointUrl, invalidName };
    });
  };

  const generateSecret = () => {
    if (!allowAccess) {
      return;
    }
    const apiKey = cryptoRandomString({ length: 50, type: 'alphanumeric' });
    setGeneratingSecret(true);
    setTimeout(() => {
      setSecretKey(apiKey);
      setGeneratingSecret(false);
    }, 500);
  };

  const resetSecret = () => {
    setSecretKey('');
  };

  const validateForm = () => {
    const errMsg = {
      name: !name.trim(),
      endpointUrl: !endpointUrl.trim(),
      invalidName: UrlEntityCharRegEx.test(name.trim()),
      invalidEndpointUrl: !isValidUrl(endpointUrl.trim()),
    };
    setShowErrorMsg(errMsg);

    return !Object.values(errMsg).includes(true);
  };

  const handleSave = () => {
    if (validateForm()) {
      const oData: CreateWebhook = {
        name,
        description: markdownRef.current?.getEditorContent() || undefined,
        endpoint: endpointUrl,
        eventFilters: getEventFilters(eventFilterFormData),
        batchSize,
        timeout: connectionTimeout,
        enabled: active,
        secretKey,
        webhookType,
      };

      onSave(oData);
    }
  };

  const getDeleteButton = () => {
    return allowAccess ? (
      <>
        {deleteState === 'waiting' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="text">
            <Loader size="small" type="default" />
          </Button>
        ) : (
          <Button
            className={classNames({
              'tw-opacity-40': !allowAccess,
            })}
            data-testid="delete-webhook"
            size="regular"
            theme="primary"
            variant="text"
            onClick={() => setIsDelete(true)}>
            Delete
          </Button>
        )}
      </>
    ) : null;
  };

  const getSaveButton = () => {
    return allowAccess ? (
      <>
        {saveState === 'waiting' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <Loader size="small" type="white" />
          </Button>
        ) : saveState === 'success' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <FontAwesomeIcon icon="check" />
          </Button>
        ) : (
          <Button
            className={classNames('tw-w-16 tw-h-10', {
              'tw-opacity-40': !allowAccess,
            })}
            data-testid="save-webhook"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleSave}>
            Save
          </Button>
        )}
      </>
    ) : null;
  };

  const fetchRightPanel = useCallback(() => {
    return (
      <div className="tw-px-2">
        <h6 className="tw-heading tw-text-base">Configure Webhooks</h6>
        <div className="tw-mb-5">
          {webhookType === WebhookType.Slack
            ? CONFIGURE_SLACK_TEXT
            : CONFIGURE_WEBHOOK_TEXT}
        </div>
      </div>
    );
  }, [webhookType]);

  return (
    <div className="add-webhook-container">
      <PageLayout
        classes="tw-max-w-full-hd tw-h-full tw-pt-4"
        header={
          <TitleBreadcrumb
            titleLinks={[
              {
                name: 'Settings',
                url: ROUTES.SETTINGS,
              },
              {
                name: webhookType === WebhookType.Slack ? 'Slack' : 'Webhook',
                url: getSettingPath(
                  GlobalSettingsMenuCategory.INTEGRATIONS,
                  webhookType === WebhookType.Slack
                    ? GlobalSettingOptions.SLACK
                    : GlobalSettingOptions.WEBHOOK
                ),
              },
              {
                name: header,
                url: '',
                activeTitle: true,
              },
            ]}
          />
        }
        layout={PageLayoutType['2ColRTL']}
        rightPanel={fetchRightPanel()}>
        <div className="tw-form-container tw-p">
          <h6 className="tw-heading tw-text-base" data-testid="header">
            {header}
          </h6>
          <div className="tw-pb-3" data-testid="formContainer">
            <Field>
              <label className="tw-block tw-form-label" htmlFor="name">
                {requiredField('Name:')}
              </label>
              {!data?.name ? (
                <input
                  className="tw-form-inputs tw-form-inputs-padding"
                  data-testid="name"
                  id="name"
                  name="name"
                  placeholder="name"
                  type="text"
                  value={name}
                  onChange={handleValidation}
                />
              ) : (
                <input
                  disabled
                  className="tw-form-inputs tw-form-inputs-padding tw-cursor-not-allowed"
                  id="name"
                  name="name"
                  value={name}
                />
              )}
              {showErrorMsg.name
                ? errorMsg('Webhook name is required.')
                : showErrorMsg.invalidName
                ? errorMsg('Webhook name is invalid.')
                : null}
            </Field>
            <Field>
              <label
                className="tw-block tw-form-label tw-mb-0"
                htmlFor="description">
                Description:
              </label>
              <RichTextEditor
                data-testid="description"
                initialValue={description}
                readonly={!allowAccess}
                ref={markdownRef}
              />
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="endpoint-url">
                {requiredField('Endpoint URL:')}
              </label>
              <input
                className="tw-form-inputs tw-form-inputs-padding"
                data-testid="endpoint-url"
                disabled={!allowAccess}
                id="endpoint-url"
                name="endpoint-url"
                placeholder="http(s)://www.example.com"
                type="text"
                value={endpointUrl}
                onChange={handleValidation}
              />
              {showErrorMsg.endpointUrl
                ? errorMsg('Webhook endpoint is required.')
                : showErrorMsg.invalidEndpointUrl
                ? errorMsg('Webhook endpoint is invalid.')
                : null}
            </Field>
            <Field>
              <div className="tw-flex tw-pt-1">
                <label>Active</label>
                <div
                  className={classNames('toggle-switch', { open: active })}
                  data-testid="active"
                  onClick={() => {
                    allowAccess && setActive((prev) => !prev);
                  }}>
                  <div className="switch" />
                </div>
              </div>
            </Field>
            {getSeparator(
              <span className="tw-text-base tw-px-0.5">
                {requiredField('Event Filters', true)}
              </span>,
              'tw-mt-3'
            )}
            <SelectComponent
              eventFilterFormData={eventFilterFormData}
              setEventFilterFormData={(data) => setEventFilterFormData(data)}
            />
            <Field>
              <div className="tw-flex tw-justify-end tw-pt-1">
                <Button
                  data-testid="show-advanced"
                  size="regular"
                  theme="primary"
                  variant="text"
                  onClick={() => setShowAdv((prev) => !prev)}>
                  {showAdv ? 'Hide Advanced Config' : 'Show Advanced Config'}
                </Button>
              </div>
            </Field>

            {showAdv ? (
              <>
                {getSeparator(
                  <span className="tw-text-base tw-px-0.5">
                    Advanced Config
                  </span>,
                  'tw-mt-3'
                )}
                <Field>
                  <div className="tw-flex tw-gap-4 tw-w-full">
                    <div className="tw-flex-1">
                      <label
                        className="tw-block tw-form-label"
                        htmlFor="batch-size">
                        Batch Size:
                      </label>
                      <input
                        className="tw-form-inputs tw-form-inputs-padding"
                        data-testid="batch-size"
                        disabled={!allowAccess}
                        id="batch-size"
                        name="batch-size"
                        placeholder="10"
                        type="number"
                        value={batchSize}
                        onChange={handleValidation}
                      />
                    </div>
                    <div className="tw-flex-1">
                      <label
                        className="tw-block tw-form-label"
                        htmlFor="connection-timeout">
                        Connection Timeout (s):
                      </label>
                      <input
                        className="tw-form-inputs tw-form-inputs-padding"
                        data-testid="connection-timeout"
                        disabled={!allowAccess}
                        id="connection-timeout"
                        name="connection-timeout"
                        placeholder="10"
                        type="number"
                        value={connectionTimeout}
                        onChange={handleValidation}
                      />
                    </div>
                  </div>
                </Field>
                <Field>
                  {allowAccess ? (
                    !data ? (
                      <>
                        <label
                          className="tw-block tw-form-label tw-my-0"
                          htmlFor="secret-key">
                          Secret Key:
                        </label>
                        <div className="tw-flex tw-items-center">
                          <input
                            readOnly
                            className="tw-form-inputs tw-form-inputs-padding"
                            data-testid="secret-key"
                            id="secret-key"
                            name="secret-key"
                            placeholder="secret key"
                            type="text"
                            value={secretKey}
                          />
                          <Button
                            className="tw-w-8 tw-h-8 tw--ml-8 tw-rounded-md"
                            data-testid="generate-secret"
                            size="custom"
                            theme="default"
                            variant="text"
                            onClick={generateSecret}>
                            {generatingSecret ? (
                              <Loader size="small" type="default" />
                            ) : (
                              <SVGIcons
                                alt="generate"
                                icon={Icons.SYNC}
                                width="16"
                              />
                            )}
                          </Button>
                          {secretKey ? (
                            <>
                              <CopyToClipboardButton copyText={secretKey} />
                              <Button
                                className="tw-h-8 tw-ml-4"
                                data-testid="clear-secret"
                                size="custom"
                                theme="default"
                                variant="text"
                                onClick={resetSecret}>
                                <SVGIcons
                                  alt="Delete"
                                  icon={Icons.DELETE}
                                  width="16px"
                                />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </>
                    ) : data.secretKey ? (
                      <div className="tw-flex tw-items-center">
                        <input
                          readOnly
                          className="tw-form-inputs tw-form-inputs-padding"
                          data-testid="secret-key"
                          id="secret-key"
                          name="secret-key"
                          placeholder="secret key"
                          type="text"
                          value={secretKey}
                        />
                        <CopyToClipboardButton copyText={secretKey} />
                      </div>
                    ) : null
                  ) : null}
                </Field>
              </>
            ) : null}
            <Field>
              {data && mode === 'edit' ? (
                <div className="tw-flex tw-justify-between">
                  <Button
                    data-testid="cancel-webhook"
                    size="regular"
                    theme="primary"
                    variant="outlined"
                    onClick={onCancel}>
                    <FontAwesomeIcon
                      className="tw-text-sm tw-align-middle tw-pr-1.5"
                      icon={faArrowLeft}
                    />{' '}
                    <span>Back</span>
                  </Button>
                  <div className="tw-flex tw-justify-end">
                    {getDeleteButton()}
                    {getSaveButton()}
                  </div>
                </div>
              ) : (
                <div className="tw-flex tw-justify-end">
                  <Button
                    data-testid="cancel-webhook"
                    size="regular"
                    theme="primary"
                    variant="text"
                    onClick={onCancel}>
                    Cancel
                  </Button>
                  {getSaveButton()}
                </div>
              )}
            </Field>
            {data && isDelete && (
              <ConfirmationModal
                bodyText={`You want to delete webhook ${data.name} permanently? This action cannot be reverted.`}
                cancelText="Cancel"
                confirmButtonCss="tw-bg-error hover:tw-bg-error focus:tw-bg-error"
                confirmText="Delete"
                header="Are you sure?"
                onCancel={() => setIsDelete(false)}
                onConfirm={handleDelete}
              />
            )}
          </div>
        </div>
      </PageLayout>
    </div>
  );
};

export default AddWebhook;
