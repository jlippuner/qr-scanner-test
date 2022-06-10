const gulp = require('gulp');
const connect = require('gulp-connect');
const copy = require('gulp-copy');
const del = require('del');
const ghPages = require('gulp-gh-pages');
const path = require('path');
const swPrecache = require('sw-precache');

const DEV_DIR = 'app';
const DIST_DIR = 'dist';

function getAssets(rootDir) {
  return [
    rootDir + '/manifest.json',
    rootDir + '/**.html',
    rootDir + '/assets/**.css',
    rootDir + '/assets/**.js',
    rootDir + '/assets/images/**',
    rootDir + '/assets/lib/material-design-lite/material.min.css',
    rootDir + '/assets/lib/material-design-lite/material.min.css.map',
    rootDir + '/assets/lib/material-design-lite/material.min.js',
    rootDir + '/assets/lib/material-design-lite/material.min.js.map',
    rootDir + '/assets/lib/jsqrcode/src/**.js'
  ];
}

function serve(rootDir) {
  return connect.server({root: rootDir});
}

function writeServiceWorkerFile(rootDir, handleFetch) {
  return swPrecache.write(path.join(rootDir, 'service-worker.js'), {
    handleFetch: handleFetch,
    staticFileGlobs: getAssets(rootDir),
    stripPrefix: rootDir + '/'
  });
}

gulp.task('clean', function() {
  return del([DIST_DIR]);
});

gulp.task('generate-service-worker-dev', function() {
  return writeServiceWorkerFile(DEV_DIR, false);
});

gulp.task('generate-service-worker-dist', function() {
  return writeServiceWorkerFile(DIST_DIR, true);
});

gulp.task('copy-dev-to-dist', function() {
  return gulp.src(getAssets(DEV_DIR))
      .pipe(copy(DIST_DIR, {prefix: 1}));
});

gulp.task('build-dev', gulp.series('generate-service-worker-dev'));

gulp.task(
    'build-dist',
    gulp.series('copy-dev-to-dist', 'generate-service-worker-dist'));


gulp.task('serve-dev', gulp.series('build-dev', function() {
  return serve(DEV_DIR);
}));

gulp.task('serve-dist', gulp.series('build-dist', function() {
  return serve(DIST_DIR);
}));

gulp.task('prod', gulp.series('clean', 'serve-dist'));
gulp.task('dev', gulp.series('serve-dev'));

gulp.task('deploy', gulp.series('build-dist', function() {
  return gulp.src(DIST_DIR + '/**/*')
      .pipe(ghPages());
}));

gulp.task('default', gulp.series('deploy'));
