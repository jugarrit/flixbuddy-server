'use strict';

module.exports = function(grunt) {
// show elapsed time at the end
require('time-grunt')(grunt);
// load all grunt tasks
require('load-grunt-tasks')(grunt);

grunt.initConfig({
    // Watch Config
    watch: {
        files: ['app.js', '!**/node_modules/**', '!Gruntfile.js', './routes/**', './controllers/**'],
        options: {
            livereload: {
                port: 9999
            },
            nospawn: true
        },
        tasks: ['express:dev']
    },

    // Express Config
    express: {
        options: {
            // Override defaults here
        },
        dev: {
            options: {
                script: 'app.js'
            }
        }
    }
});

// Restart
grunt.registerTask('dev', ['express:dev', 'watch']);
};
