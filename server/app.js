const express = require('express');
const path = require('path');
const utils = require('./lib/hashUtils');
const partials = require('express-partials');
const bodyParser = require('body-parser');
const Auth = require('./middleware/auth');
const models = require('./models');

const app = express();

app.set('views', `${__dirname}/views`);
app.set('view engine', 'ejs');
app.use(partials());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.use(require('./middleware/cookieParser'));
app.use(Auth.createSession);

app.get('/', Auth.verifySession,
(req, res) => {
  res.render('index');
});

app.get('/create', Auth.verifySession,
(req, res) => {
  res.render('index');
});

app.get('/links', Auth.verifySession,
(req, res, next) => {
  models.Links.getAll()
    .then(links => {
      res.status(200).send(links);
    })
    .error(error => {
      res.status(500).send(error);
    });
});

app.post('/links', Auth.verifySession,
(req, res, next) => {
  var url = req.body.url;
  if (!models.Links.isValidUrl(url)) {
    // send back a 404 if link is not valid
    return res.sendStatus(404);
  }

  return models.Links.get({ url })
    .then(link => {
      if (link) {
        throw link;
      }
      return models.Links.getUrlTitle(url);
    })
    .then(title => {
      return models.Links.create({
        url: url,
        title: title,
        baseUrl: req.headers.origin
      });
    })
    .then(results => {
      return models.Links.get({ id: results.insertId });
    })
    .then(link => {
      throw link;
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch(link => {
      res.status(200).send(link);
    });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/login', (req, res) => {
  res.render('login');
})

app.get('/signup', (req, res) => {
  res.render('signup');
})

app.get('/logout', (req, res, next) => {
  return models.Sessions.delete({hash: req.cookies.shortlyid})
    .then(() => {
      res.clearCookie('shortlyid');
      res.redirect('/login');
    })
    .error(error => {
      res.status(500).send(error);
    })
})

app.post('/login', (req, res, next) => {
  let username = req.body.username;
  let password = req.body.password;

  // find user by username
  return models.Users.get({username})
    .then((user) => {
      // if !found or password is not valid
      if (!user || !models.Users.compare(password, user.password, user.salt)) {
        // redirect to '/login'
        throw new Error('Username or password not valid');
      }
      return models.Sessions.update({id: req.session.id}, {userId: user.id});
    })
    .then(() => {
      // otherwise, redirect to '/'
      res.redirect('/');
    })
    .error((error) => {
      res.status.send(error);
    })
    .catch(() => {
      res.redirect('/login');
    })

})

app.post('/signup', (req, res, next) => {
  let username = req.body.username;
  let password = req.body.password;
  // check for user
  return models.Users.get({username})
    .then((user) => {
      // if exists, redirect to /signup
      if (user) {
        console.log('username has already exists!');
        throw user;
      }
      // otherwise, create a user
      return models.Users.create({ username, password });
    })
    .then((results) => {
      // upgrade session to associate with user
      return models.Sessions.update({ id: req.session.id }, { userId: results.insertId});
    })
    .then(() => {
      res.redirect('/');
    })
    .error(error => res.status(500).send(error))
    .catch((user) => {
      res.redirect('/signup');
    })

  // redirect the user to '/' route
})

/************************************************************/
// Handle the code parameter route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/:code', (req, res, next) => {

  return models.Links.get({ code: req.params.code })
    .tap(link => {

      if (!link) {
        throw new Error('Link does not exist');
      }
      return models.Clicks.create({ linkId: link.id });
    })
    .tap(link => {
      return models.Links.update(link, { visits: link.visits + 1 });
    })
    .then(({ url }) => {
      res.redirect(url);
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch(() => {
      res.redirect('/');
    });
});

module.exports = app;
