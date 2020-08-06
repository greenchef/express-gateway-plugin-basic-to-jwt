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
    const getAndCheckTokenExpiration = async (tokenKey, timeToCheck = 30) => {
      const tokenInCache = await defaultClient.get(tokenKey);
      if (!tokenInCache) return null;
      const decodedToken = jwt.decode(tokenInCache);
      return (decodedToken.exp - (Date.now() / 1000)) > timeToCheck ? tokenInCache : null;
    }

    return async (req, res, next) => {
      let refreshRedisKey;
      try {
				const authHeader = (req.headers || {}).authorization;
				if (authHeader && authHeader.startsWith('Basic ')) {
          const credentials = auth(req);
          const redisKey = `${credentials.name}~?~${credentials.pass}`;
          const goodToken = await getAndCheckTokenExpiration(redisKey);
          if (goodToken) {
            req.headers = {
              ...req.headers,
              authorization: `Bearer ${goodToken}`,
            }
            return next();
          }
          refreshRedisKey = `${credentials.name}~?~${credentials.pass}~?~refreshInProgress`;
          let token = await getAndCheckTokenExpiration(redisKey, 2);
          let needsRefresh = null;
          const refreshInProgress = await defaultClient.get(refreshRedisKey);
          if (refreshInProgress && !token) {
            let pollingCount = 0;
              await new Promise((res) => {
                setInterval(async () => {
                  const refreshKeyExists = await defaultClient.get(refreshRedisKey)
                  if (!refreshKeyExists) {
                    token = await defaultClient.get(redisKey);
                    clearInterval();
                    res();
                  } else {
                    pollingCount += 1;
                    if (pollingCount >= 10) {
                      clearInterval();
                      res()
                    }
                  }
                }, 200)
              });
          } else if (!refreshInProgress) {
            defaultClient.set(refreshRedisKey, true, 'EX', 10);
            needsRefresh = true;
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
          return next();
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


  