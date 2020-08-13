module.exports = {
  version: '1.3.2',
  init: (pluginContext) => {
     pluginContext.registerPolicy(require('./policies/basic-to-jwt.policy'))
  },
  policies: ['basic-to-jwt'],
  schema: {
    $id: 'N/A',
  }
}
