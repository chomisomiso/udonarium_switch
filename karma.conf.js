// Karma 設定。詳細は https://karma-runner.github.io/6.4/config/configuration-file.html
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {
        // 実行順のゆらぎで隠れた依存に気づけるようランダム実行を有効にしておく。
        // ObjectStore / EventSystem はシングルトンなので、後始末漏れはここで露見する
        random: true,
      },
      // 個別のテスト結果を Jasmine の HTML レポータに残す
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true, // 重複トレースを畳む
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
      ],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadless'],
    customLaunchers: {
      // CI コンテナは /dev/shm が 64MB しかなく Chrome が落ちることがある
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
