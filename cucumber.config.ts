export default {
  default: {
    paths: ['features/**/*.feature'],
    requireModule: ['ts-node/register'],
    require: ['features/step-definitions/**/*.ts'],
    format: ['progress', 'html:cucumber-report.html'],
  },
};
