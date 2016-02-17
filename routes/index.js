var express = require('express');
var router = express.Router();
var request = require('request');
var config = require('../config');
var YAML = require('yamljs');
var rules = YAML.load('./data/rules.yaml');
var simple_recaptcha = require('simple-recaptcha');

router.get('/', function(req, res) {
  res.render('index', { community: config.community,
                        tokenRequired: !!config.inviteToken });
});

router.get('/about', function(req, res) {
  res.render('about', {});
});

router.get('/rules', function(req, res) {
  res.render('rules', { ruleData: rules });
});

router.post('/invite', function(req, res) {
  var privateKey = config.googleRecaptchaKey;
  var ip = req.ip;
  var recaptchaChallenge = req.body.recaptcha_challenge_field;
  var recaptchaResponse = req.body.recaptcha_response_field;

  simple_recaptcha(privateKey, ip, recaptchaChallenge, recaptchaResponse, function(err) {
    if (err) {
      res.render('result', {
        community: config.community,
        message: 'Failed! I think you are a robot.',
        isFailed: true
      });
    } else {
      if (req.body.email && (!config.inviteToken || (!!config.inviteToken && req.body.token === config.inviteToken))) {
        request.post({
            url: 'https://'+ config.slackUrl + '/api/users.admin.invite',
            form: {
              email: req.body.email,
              token: config.slacktoken,
              set_active: true
            }
          }, function(err, httpResponse, body) {
            // body looks like:
            //   {"ok":true}
            //       or
            //   {"ok":false,"error":"already_invited"}
            if (err) { return res.send('Error:' + err); }
            body = JSON.parse(body);
            if (body.ok) {
              res.render('result', {
                community: config.community,
                message: 'Success! Check "'+ req.body.email +'" for an invite from Slack.'
              });
            } else {
              var error = body.error;
              if (error === 'already_invited' || error === 'already_in_team') {
                res.render('result', {
                  community: config.community,
                  message: 'Success! You were already invited.<br>' +
                           'Visit to <a href="https://'+ config.slackUrl +'">'+ config.community +'</a>'
                });
                return;
              } else if (error === 'invalid_email') {
                error = 'The email you entered is an invalid email.'
              } else if (error === 'invalid_auth') {
                error = 'Something has gone wrong. Please contact a system administrator.'
              }

              res.render('result', {
                community: config.community,
                message: 'Failed! ' + error,
                isFailed: true
              });
            }
          });
      } else {
        var errMsg = [];
        if (!req.body.email) {
          errMsg.push('your email is required');
        }

        if (!!config.inviteToken) {
          if (!req.body.token) {
            errMsg.push('valid token is required');
          }

          if (req.body.token && req.body.token !== config.inviteToken) {
            errMsg.push('the token you entered is wrong');
          }
        }

        res.render('result', {
          community: config.community,
          message: 'Failed! ' + errMsg.join(' and ') + '.',
          isFailed: true
        });
      }
    }
  });
});

module.exports = router;
