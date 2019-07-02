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
  policy: ({ authUrl }) => {
    return (req, res, next) => {
      console.log('Executing "basic-to-jwt" policy with "authServiceUrl" of', authUrl);
      next() // calling next policy
      // or write response:  res.json({result: "this is the response"})
    };
  }
};
