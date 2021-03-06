/**
 * Lo-Dash 2.2.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize underscore exports="amd" -o ./underscore/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
define(['./filter', './find', '../objects/isEmpty'], function(filter, find, isEmpty) {

  /** Used as a safe reference for `undefined` in pre ES5 environments */
  var undefined;

  /**
   * Performs a deep comparison of each element in a `collection` to the given
   * `properties` object, returning an array of all elements that have equivalent
   * property values.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Collections
   * @param {Array|Object|string} collection The collection to iterate over.
   * @param {Object} properties The object of property values to filter by.
   * @returns {Array} Returns a new array of elements that have the given properties.
   * @example
   *
   * var stooges = [
   *   { 'name': 'curly', 'age': 30, 'quotes': ['Oh, a wise guy, eh?', 'Poifect!'] },
   *   { 'name': 'moe', 'age': 40, 'quotes': ['Spread out!', 'You knucklehead!'] }
   * ];
   *
   * _.where(stooges, { 'age': 40 });
   * // => [{ 'name': 'moe', 'age': 40, 'quotes': ['Spread out!', 'You knucklehead!'] }]
   *
   * _.where(stooges, { 'quotes': ['Poifect!'] });
   * // => [{ 'name': 'curly', 'age': 30, 'quotes': ['Oh, a wise guy, eh?', 'Poifect!'] }]
   */
  function where(collection, properties, first) {
    return (first && isEmpty(properties))
      ? undefined
      : (first ? find : filter)(collection, properties);
  }

  return where;
});
