package org.openmetadata.catalog;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Retention(RetentionPolicy.RUNTIME)
@Target(value = ElementType.METHOD)
public @interface Function {
  String name();

  String input();

  String description();

  String[] examples();

  /**
   * Some functions are used for capturing resource based rules where policies are applied based on resource being
   * accessed and team hierarchy the resource belongs to instead of the subject.
   */
  boolean resourceBased() default false;
}
