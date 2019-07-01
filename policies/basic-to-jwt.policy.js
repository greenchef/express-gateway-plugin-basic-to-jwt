module.exports = {
  name: 'basic-to-jwt',
  schema: {
    type: object,
    properties: {
      authServiceUrl: { // Where to access the auth service for passing the basic credentials
        type: 'string',
        format: 'url',
      }
    }
  },
  policy: ({ authServiceUrl }) => {
    return (req, res, next) => {
      console.log('Executing "basic-to-jwt" policy with "authServiceUrl" of', authServiceUrl);
      next() // calling next policy
      // or write response:  res.json({result: "this is the response"})
    };
  }
};
