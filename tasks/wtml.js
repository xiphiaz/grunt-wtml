/*
 * grunt-wtml
 * https://github.com/xiphiaz/grunt-wtml
 *
 * Copyright (c) 2013 Zak Henry
 * Licensed under the MIT license.
 */

'use strict';

var wtml = require('wtml'),
    wtmlTranslator = new wtml();

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('wtml', 'Converts .wtml template files into .tpl.html files', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      punctuation: '.',
      separator: ', '
    });

    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      // Concat specified files.
      var src = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function(filepath) {
        // Read file source.
        return grunt.file.read(filepath);
      });

      // Handle options.
//      src += options.punctuation;

        src = wtmlTranslator.translate(src[0]);

      // Write the destination file.
      grunt.file.write(f.dest, src);

      // Print a success message.
      grunt.log.writeln('File "' + f.dest + '" created.');
    });
  });

};