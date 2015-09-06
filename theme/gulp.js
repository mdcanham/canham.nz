'use strict';

/**
 * Handle all of the theme building tasks
 * NOTE: This file is imported by the top-level gulp file
 * so all files are relative to there (except for requiring stuff)
 *
 * However, we still try to keep dependencies separate between the theme
 * and the rest of the project **except** for gulp itself
 */

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var browserSync = require('browser-sync').create();
var argv = require('yargs').argv;
var sequence = require('run-sequence');
var path = require('path');
var del = require('del');
var env = require('node-env-file');
var browserify = require('browserify');
var reload = browserSync.reload;

var keypress = require('keypress');

var isDist = argv.dist;
var isServing = false;

var composer = require('../composer.json');
var assetsDir = path.join(composer.extra['bolt-web-dir'] || './', 'theme-assets');

try {
  env(path.join(__dirname, '.env'));
} catch (e) {
  console.error('Could not load .env file');
}

var onError = function onError(err) {
  $.util.beep();
  console.log(err.message);
  this.emit('end');
};


// Compile styles into a single css file
gulp.task('clean:css', function(cb) {
  del([assetsDir + '/styles/**/*.*', 'theme/_tmp/styles/**/*.*'], cb);
});

gulp.task('css', ['clean:css'], function() {
  var includes = [path.join(__dirname, 'node_modules')];

  return gulp.src(['theme/css/main.css'], { base: path.join(__dirname, 'css') })
    .pipe($.plumber({
      errorHandler: onError
    }))
    .pipe($.if(!isDist, $.sourcemaps.init()))
    .pipe($.cssnext({
      import: {
        path: includes
      }
    }))
    .pipe($.autoprefixer({cascade: false}))
    .pipe($.if(isDist, $.minifyCss()))
    .pipe(gulp.dest('theme/_tmp/styles'));
});


// Compile scripts into a single js file
gulp.task('clean:js', function(cb) {
  del([assetsDir + '/scripts/**/*.*', 'theme/_tmp/scripts/**/*.*', '!theme/_tmp/scripts/modernizr.js'], cb);
});

var jsIncludes = [
  'theme/node_modules/jquery/dist/jquery.js',
  'theme/js/canham.js',
  'theme/js/lib/**/*.js',
  'theme/js/contexts/**/*.js',
  'theme/js/main.js'
];
gulp.task('js', ['clean:js'], function() {
  return gulp.src(jsIncludes)
    .pipe($.if(!isDist, $.sourcemaps.init()))
    .pipe($.concat('main.js')).pipe($.if(isDist, $.uglify()))
    .pipe($.if(!isDist, $.sourcemaps.write()))
    .pipe(gulp.dest('theme/_tmp/scripts'));
});

// Modernizr build
gulp.task('clean:modernizr', function (cb) {
  del(['theme/_tmp/scripts/modernizr.js'], cb)
});

gulp.task('modernizr', ['clean:modernizr'], function () {
  return gulp.src(['theme/_tmp/scripts/*.js', 'theme/_tmp/styles/*.css'])
    .pipe($.modernizr())
    .pipe(gulp.dest('theme/_tmp/scripts'))
});

// Move images over
gulp.task('clean:img', function(cb) {
  del([assetsDir + '/images/**/*.*', 'theme/_tmp/images/**/*.*'], cb);
});

gulp.task('img', ['clean:img'], function() {
  return gulp.src('theme/images/**/*')
    .pipe(gulp.dest('theme/_tmp/images'));
});


// Replace names in templates with fingerprinted file names for cache-busting
gulp.task('clean:rev', function(cb) {
  del('theme/rev-manifest.json', cb);
});

gulp.task('rev', ['clean:rev'], function() {
  var rev = new $.revAll();
  var src = gulp.src('theme/_tmp/**/*.*');

  if (isDist) {
    src.pipe(rev.revision())
      .pipe(gulp.dest(assetsDir))
      .pipe(rev.manifestFile())
      .pipe(gulp.dest('theme'));
  } else {
    src.pipe($.changed(assetsDir, { hasChanged: $.changed.compareSha1Digest }))
      .pipe(gulp.dest(assetsDir))
      .pipe(reload({ stream: true }));
  }

  return src;
});


// Watch for file changes
gulp.task('watch', ['build'], function() {
  gulp.watch('theme/js/**/*', function() {
    sequence('js', 'rev', reload);
  });
  gulp.watch('theme/less/**/*', function() {
    sequence('css', 'rev');
  });
  gulp.watch('theme/images/**/*', function() {
    sequence('img', 'rev');
  });
  gulp.watch('templates/**/*', function() {
    sequence('rev', reload);
  });

  // Keypress logic
  keypress(process.stdin);

  process.stdin.on('keypress', function (ch, key) {
    // Ctrl+C means close
    if (key && key.ctrl && key.name == 'c') {
      process.exit();
    }

    // Modernizr rebuild
    if (key.name == 'm') {
      sequence('modernizr', 'rev');
    }
  });

  process.stdin.setRawMode(true);
  process.stdin.resume();
});

gulp.task('htaccess', function() {
  gulp.src('theme/htaccess', { base: 'theme' })
    .pipe($.rename('.htaccess'))
    .pipe($.if(isDist, gulp.dest(assetsDir)));
});

// Just build the thing
gulp.task('clean:build', function(cb) {
  del(['_tmp', 'theme-assets'], cb);
});

gulp.task('build', ['clean:build'], function() {
    sequence(['htaccess', 'js', 'css', 'img'], 'modernizr', 'rev');
});

gulp.task('serve', function() {
  isServing = true;
  browserSync.init({
    proxy: process.env.DEVELOPMENT_URL,
    open: false,
    ghostMode: {
      clicks: false,
      forms: false,
      scroll: true
    }
  });
  sequence('watch');
});

gulp.task('default', ['serve']);
