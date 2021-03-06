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
      const authHeader = (req.headers || {}).authorization;
      if (authHeader && authHeader.startsWith('Basic ')) {
        const credentials = auth(req);
        const redisKey = `${credentials.name}~?~${credentials.pass}`;
        const refreshRedisKey = `${credentials.name}~?~${credentials.pass}~?~refreshInProgress`;

        const waitForNewToken = () => {
          return new Promise((res) => {
						let pollingCount = 0;
						let intervalFunc = null;
            intervalFunc = setInterval(async () => {
              const refreshKeyExists = await defaultClient.get(refreshRedisKey)
              if (!refreshKeyExists) {
								clearInterval(intervalFunc);
								res();
								return;
              } else {
                pollingCount += 1;
                if (pollingCount >= 20) {
									clearInterval(intervalFunc);
									res()
									return;
                }
              }
            }, 200)
          });
        }

        const getAndCheckTokenExpiration = async (tokenKey, timeToCheck = 2) => {
          const tokenInCache = await defaultClient.get(tokenKey);
          if (!tokenInCache) return null;
          const decodedToken = jwt.decode(tokenInCache);
          return (decodedToken.exp - (Date.now() / 1000)) > timeToCheck ? tokenInCache : null;
        }

        const getNewTokenAndSetInCache = async (creds) => {
					await defaultClient.set(refreshRedisKey, true)
          const response = await request({
            method: 'POST',
            uri: authUrl,
            body: {
              [nameProperty]: creds.name,
              [passProperty]: creds.pass
            },
            json: true
          });

          const token = tokenProperty ? response[tokenProperty] : response;
          if (cacheSeconds) {
            defaultClient.set(redisKey, token, 'EX', cacheSeconds);
          } else {
            defaultClient.set(redisKey, token);
          }
          if (refreshRedisKey) {
            defaultClient.del(refreshRedisKey);
          }
          return token;
        }

        const updateHeadersAndNext = (token) => {
          req.headers = {
            ...req.headers,
            authorization: `Bearer ${token}`,
          }
        }
        try {
          const token = await getAndCheckTokenExpiration(redisKey);
          if (token) {
            updateHeadersAndNext(token);
          } else {
            const refreshInProgress = await defaultClient.get(refreshRedisKey);
            if (refreshInProgress) {
              await waitForNewToken();
							const newToken = await getAndCheckTokenExpiration(redisKey);
              updateHeadersAndNext(newToken);
            } else {
              const newToken = await getNewTokenAndSetInCache(credentials);
              updateHeadersAndNext(newToken);
            }
          }
        } catch (e) {
          if (refreshRedisKey) {
            defaultClient.del(refreshRedisKey);
          }
          console.error('Error in basic-to-jwt policy:', e);
					res.sendStatus(e.statusCode);
					return;
        }
			}
      next();
    }
  }
};
