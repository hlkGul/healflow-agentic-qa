export default {
  default: {
    paths: ['features/**/*.feature'],
    import: ['src/step-definitions/**/*.ts'],
    format: ['progress-bar', 'html:cucumber-report.html'],
  },
};
