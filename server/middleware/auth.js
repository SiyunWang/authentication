const models = require('../models');
const Promise = require('bluebird');

module.exports.createSession = (req, res, next) => {

  // check for session cookie
  Promise.resolve(req.cookies.shortlyid)
    .then((hash) => {
      // if !exists -> make a new session
      if (!hash) {
        // make a new session
        throw hash;
      }
      // attempt to load session from database
      return models.Sessions.get({hash});
    })
    .then((session) => {
      // if !exists -> make a new session
      if (!session) {
        // make s session
        throw session;
      }
      return session;
    })
    .catch(() => {
      // make a new session
      return models.Sessions.create()
        .then((results) => {
          return models.Sessions.get({id: results.insertId});
        })
        .then((session) => {
          res.cookie('shortlyid', session.hash);
          return session;
        })
    })
    // otherwise -> set session on req object
    .then((session) => {
      req.session = session;
      next();
    })

};

/************************************************************/
// Add additional authentication middleware functions below
/************************************************************/

module.exports.verifySession = (req, res, next) => {
  if (!models.Sessions.isLoggedIn(req.session)) {
    res.redirect('/login');
  } else {
    next();
  }
}