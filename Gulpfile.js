const gulp = require("gulp");
const connect = require("gulp-connect");
const copy = require("gulp-copy");
const del = require("del");
const ghPages = require("gulp-gh-pages");
const path = require("path");
const swPrecache = require("sw-precache");
const browserify = require("browserify");
var tap = require("gulp-tap");
var buffer = require("gulp-buffer");
var sourcemaps = require("gulp-sourcemaps");

const DEV_DIR = "app";
const DIST_DIR = "dist";

function getAssets(rootDir) {
  return [
    rootDir + "/manifest.json",
    rootDir + "/**.html",
    rootDir + "/assets/**.css",
    rootDir + "/assets/**.js",
    rootDir + "/assets/images/**",
    rootDir + "/assets/lib/material-design-lite/material.min.css",
    rootDir + "/assets/lib/material-design-lite/material.min.css.map",
    rootDir + "/assets/lib/material-design-lite/material.min.js",
    rootDir + "/assets/lib/material-design-lite/material.min.js.map",
    rootDir + "/assets/lib/jsqrcode/src/**.js",
  ];
}

function serve(rootDir) {
  return connect.server({ root: rootDir });
}

function writeServiceWorkerFile(rootDir, handleFetch) {
  return swPrecache.write(path.join(rootDir, "service-worker.js"), {
    handleFetch: handleFetch,
    maximumFileSizeToCacheInBytes: 128 * 1024 * 1024,
    staticFileGlobs: getAssets(rootDir),
    stripPrefix: rootDir + "/",
  });
}

gulp.task("clean", function () {
  return del([DIST_DIR]);
});

function bundle(enable_debug) {
  return (
    gulp
      .src("app/sync_worker.js", { read: false }) // no need of reading file because browserify does.
      // transform file objects using gulp-tap plugin
      .pipe(
        tap(function (file) {
          // replace file contents with browserify's bundle stream
          file.contents = browserify(file.path, {
            debug: enable_debug,
          }).bundle();
        })
      )
      // transform streaming contents into buffer contents (because gulp-sourcemaps does not support streaming contents)
      .pipe(buffer())
      // load and init sourcemaps
      .pipe(sourcemaps.init({ loadMaps: true }))
      // write sourcemaps
      .pipe(sourcemaps.write("./"))
      .pipe(gulp.dest("app/assets"))
  );
}

gulp.task("browserify-debug", function () {
  return bundle(true);
});

gulp.task("browserify", function () {
  return bundle(false);
});

gulp.task("generate-service-worker-dev", function () {
  return writeServiceWorkerFile(DEV_DIR, false);
});

gulp.task("generate-service-worker-dist", function () {
  return writeServiceWorkerFile(DIST_DIR, true);
});

gulp.task("copy-dev-to-dist", function () {
  return gulp.src(getAssets(DEV_DIR)).pipe(copy(DIST_DIR, { prefix: 1 }));
});

gulp.task(
  "build-dev",
  gulp.series("browserify-debug", "generate-service-worker-dev")
);

gulp.task(
  "build-dist",
  gulp.series("browserify", "copy-dev-to-dist", "generate-service-worker-dist")
);

gulp.task(
  "serve-dev",
  gulp.series("build-dev", function () {
    return serve(DEV_DIR);
  })
);

gulp.task(
  "serve-dist",
  gulp.series("build-dist", function () {
    return serve(DIST_DIR);
  })
);

gulp.task("prod", gulp.series("clean", "serve-dist"));
gulp.task("dev", gulp.series("serve-dev"));

gulp.task(
  "deploy",
  gulp.series("build-dist", function () {
    return gulp.src(DIST_DIR + "/**/*").pipe(ghPages());
  })
);

gulp.task("default", gulp.series("deploy"));
