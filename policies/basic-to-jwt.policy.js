const auth = require('basic-auth');
const request = require('request-promise-native');

module.exports = {
  name: 'basic-to-jwt',
  schema: {
    $id: 'N/A',
    type: 'object',
    properties: {
      authUrl: { // Where to access the auth service for passing the basic credentials
        type: 'string',
      }
    }
  },
  policy: ({ authUrl, nameProperty, passProperty }) => {
    return async (req, res, next) => {
      try {
				const authHeader = (req.headers || {}).authorization;
				if (authHeader && authHeader.startsWith('Basic ')) {
          const credentials = auth(req);
					const token = await request({
            method: 'POST',
						uri: authUrl,
            body: {
              [nameProperty]: credentials.name,
              [passProperty]: credentials.pass
            },
            json: true
					});
					req.headers = {
						...req.headers,
						authorization: `Bearer ${token}`,
					}
				}
      } catch (e) {
        console.error('Request to auth service failed. Error:', e.error)
        res.sendStatus(e.statusCode)
        return;
      }
      next();
    };
  }
};
