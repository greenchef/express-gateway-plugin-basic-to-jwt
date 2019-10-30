module.exports = {
  version: '1.2.3',
  init: (pluginContext) => {
     pluginContext.registerPolicy(require('./policies/basic-to-jwt.policy'))
  },
  policies: ['basic-to-jwt'],
  schema: {
    $id: 'N/A',
  }
}
