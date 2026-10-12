const passport = require('passport');
const { Strategy: GitHubStrategy } = require('passport-github2');
const User = require('../models/User');
const { env } = require('./env');

function configurePassport() {
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.github.clientId,
        clientSecret: env.github.clientSecret,
        callbackURL: env.github.callbackUrl,
        scope: ['read:user', 'user:email'],
      },
      async (accessToken, _refreshToken, profile, done) => {
        try {
          const user = await User.findOneAndUpdate(
            { githubId: String(profile.id) },
            {
              githubId: String(profile.id),
              username: profile.username,
              displayName: profile.displayName || profile.username,
              email: profile.emails?.[0]?.value || '',
              avatarUrl: profile.photos?.[0]?.value || '',
              profileUrl: profile.profileUrl || `https://github.com/${profile.username}`,
              accessToken,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  return passport;
}

module.exports = { configurePassport, passport };
