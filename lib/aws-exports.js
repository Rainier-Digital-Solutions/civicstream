const awsconfig = {
  Auth: {
    region: process.env.NEXT_PUBLIC_COGNITO_REGION,
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    userPoolWebClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    oauth: {
      domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
      scope: ['email', 'profile', 'openid'],
      redirectSignIn: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/',
      redirectSignOut: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/login` : 'http://localhost:3000/login',
      responseType: 'code',
    },
  },
};

export default awsconfig;
