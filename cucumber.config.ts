export default {
  default: {
    paths: ['features/**/*.feature'],
    requireModule: ['ts-node/register'],
    require: ['src/step-definitions/**/*.ts'],
    format: ['progress', 'html:cucumber-report.html'],
  },
};
