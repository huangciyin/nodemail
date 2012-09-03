var util = require('util');
var mailUtil = require('./mail-util');
var fs = require('fs');
var MailParser = require('mailparser').MailParser;
var emitter = new (require('events').EventEmitter)();

var cb = mailUtil.cb;
var isFunction = mailUtil.isFunction;
var imap, mailObject = {};

emitter.on('response', function(res) {
  mailObject.msgs = mailObject.msgs.reverse();
  res.json({
    status: 'success',
    data: mailObject
  });
  console.log('Done fetching all messages!');
  // imap.logout(cb);
});

exports.index = function(req, res) {
  res.render('mail/inbox.html');
}

exports.getList = function(req, res) {
  _getMail(req, res);
}

// exports.getBoxes = function(req, res) {
//   _connect(function() {
//     _getBoxes(req, res);
//   });
// }

function _getMail(req, res) {
  var user = req.session.user;
  if (!user) return;

  if (!imap) {
    imap = mailUtil.connection(user);
  }

  mailUtil.setHandlers([
  _connect, _openBox, _search, function(results) {
    _fetch(results, res);
  }]);

  cb();
}

function _connect(fn) {
  imap.connect(cb);
  // imap.connect(function(err, results) {
  //   cb(err, results);
  //   isFunction(fn) && fn();
  // });
}

function _openBox() {
  imap.openBox('INBOX', false, cb);
}

function _search(results) {
  mailObject.messages = results.messages;
  imap.search(['ALL', ['SINCE', 'August 28, 2012']], cb);
}

function _fetch(results, res) {
  var msgLength = results.length,
    fetch = imap.fetch(results, {
      request: {
        body: 'full',
        headers: false
        // headers: ['from', 'to', 'subject', 'date']
      }
    });

  console.log('total:', msgLength);

  var fileStream, msgChunk = '', bufferHelper;
  mailObject.msgs = [];

  fetch.on('message', function(msg) {
    var fileName = 'msg-' + msg.seqno + '-raw.txt';
    fileStream = fs.createWriteStream(fileName);
    msg.on('data', function(chunk) {
      fileStream.write(chunk);
      msgChunk = chunk;
    });
    msg.on('end', function() {
      if (msgChunk) {
        var mp = new MailParser();
        mp.setMaxListeners(100);

        // setup an event listener when the parsing finishes
        // mp.on('headers', function(headers){
        //   headers = headers;
        // });
        mp.on("end", function(mail) {
          mailObject.msgs.push({
            'msg': msg,
            'mail': mail
          });

          if (msgLength == mailObject.msgs.length) {
            emitter.emit('response', res);
          }
        });

        // var mail = new Buffer(msgChunk, 'utf-8');
        // for (var i = 0, len = mail.length; i < len; i++) {
        //   mp.write(new Buffer([mail[i]]));
        // }

        fs.createReadStream(fileName).pipe(mp);

        // send the email source to the parser
        // mp.write(msgChunk);
        // mp.end();
      }

      fileStream.end();
    });
  });

  // fetch.on('end', function() {
    // mailObject.msgs = mailObject.msgs.reverse();
    // res.json({
    //   status: 'success',
    //   data: mailObject
    // });
    // console.log('Done fetching all messages!');
    // imap.logout(cb);
  // });
}

// function _getBoxes(req, res) {
//   imap.getBoxes(function(err, results) {
//     res.json({
//       status: 'success',
//       data: results
//     });
//   });
// }