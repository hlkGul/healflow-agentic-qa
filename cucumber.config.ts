export default {
  default: {
    paths: ['features/**/*.feature'],
    import: ['src/support/**/*.ts', 'src/step-definitions/**/*.ts'],
    format: ['progress-bar', 'html:cucumber-report.html'],
  },
};
