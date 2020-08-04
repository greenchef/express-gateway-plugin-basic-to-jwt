const auth = require('basic-auth');
const jwt = require('jsonwebtoken');
const request = require('request-promise-native');

const { defaultClient } = require('../initializers/redis');

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
  policy: ({ authUrl, nameProperty, passProperty, tokenProperty, cacheSeconds = 0 }) => {
    return async (req, res, next) => {
      let refreshRedisKey;
      try {
				const authHeader = (req.headers || {}).authorization;
				if (authHeader && authHeader.startsWith('Basic ')) {
          const credentials = auth(req);
          const redisKey = `${credentials.name}~?~${credentials.pass}`;
          refreshRedisKey = `${credentials.name}~?~${credentials.pass}~?~refreshInProgress`;
          let token = await defaultClient.get(redisKey);
          let needsRefresh = null;
          if (token) {
            const refreshInProgress = await defaultClient.get(refreshRedisKey);
            const decodedToken = jwt.decode(token);
            if ((decodedToken.exp - (Date.now() / 1000)) <= 30) {
              if (!refreshInProgress) {
                defaultClient.set(refreshRedisKey, true, 'EX', 10);
                needsRefresh = true;
              } else if ((decodedToken.exp - (Date.now() / 1000)) <= 1) {
                let checks = 0;
                token = null;
                let decodeCheck = null;
                while (checks < 10 && !token) {
                  // wait for a second and poll every 200ms for new token
                  // if no token found in that time go through anyway - will fail
                  await new Promise((res) => {
                    setTimeout(() => {
                      res();
                    }, 200)
                  });
                  token = await defaultClient.get(redisKey);
                  decodeCheck = jwt.decode(token).exp;
                  if ((decodeCheck - (Date.now() / 1000)) <= 1)  {
                    token = null;
                    checks += 1;
                  }
                }
                if (!token) {
                  token = 'bad token'
                }
              }
            }
          }
          if (!token || needsRefresh) {
            const response = await request({
              method: 'POST',
              uri: authUrl,
              body: {
                [nameProperty]: credentials.name,
                [passProperty]: credentials.pass
              },
              json: true
            });
            token = tokenProperty ? response[tokenProperty] : response;
            if (cacheSeconds) {
              defaultClient.set(redisKey, token, 'EX', cacheSeconds);
            } else {
              defaultClient.set(redisKey, token);
            }
            if (needsRefresh && refreshRedisKey) {
              defaultClient.del(refreshRedisKey);
            } 
          }
					req.headers = {
						...req.headers,
						authorization: `Bearer ${token}`,
					}
				}
      } catch (e) {
        if (refreshRedisKey) {
          defaultClient.del(refreshRedisKey);
        }
        console.error('Error in basic-to-jwt policy:', e)
        res.sendStatus(e.statusCode)
        return;
      }
      next();
    };
  }
};


  