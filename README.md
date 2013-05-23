# Streamee.js

Streamee.js is a set of stream transformers for node.js that integrates seamlessly with Q promises. It can be seen as a mix of async and underscore.js,
but for streams!

One of the most useful feature of streams is **back-pressure** (if the bottom of the stream is slow, then the top will automatically push slowly,
so that the memory consumption in node). Streamee.js allows you to build very easily pipelines that compose and transform streams, so that you can keep
back-pressure all the way long. All transformation functions can return **Q promises** instead of direct value, which makes asynchronous operations less verbose and more functional (less callback hell!).

Inspired from [Play Framework Enumeratee](http://www.playframework.com/documentation/2.1.1/Enumeratees).

Example app:
```javascript
var ee = require('ee');
var Q = require('q');
var http = require('http');
var stream = require('stream');
var request = require('request');
var express = require('express');
var app = express();

// GET a http chunked stream (for example a stream of json objects)
function GETstream(url) {
  var deferred = Q.defer();
  http.get(url, function(res) { 
    deferred.resolve(new stream.Readable({objectMode: true}).wrap(res));
  });
  return ee.flattenReadable(deferred.promise); // flatten a Promise[stream.Readable] to a stream.Readable (that's cool right?)
}

// GET a promise of the http response body
function GET(url) {
  var deferred = Q.defer();
  request(url, function(err, res, body) {
    if (!err && res.statusCode == 200) deferred.resolve(body)
    else deferred.reject(err);
  });
  return deferred.promise;
}

app.get('/', function(req, res) {
  var src1 = GETstream('http://localhost:3001/'); // stream of json objects {x:<int>, id:<string>}
  var src2 = GETstream('http://localhost:3002/'); // another stream of json objects {x:<int>, id:<string>}

  ee.pipeAndRun(
    ee.interleave([src1, src2]), // we mix the 2 streams
    ee.map(ee.obj, function(obj) { // 'ee.obj' means that we want to have the input as a json object
      obj.someNewField = 'something';
      return obj;
    }),
    ee.collect(ee.obj, function(obj) { // collect is filter + map
      // we keep only certain objects, and then we fetch some corresponding data asynchronously by returning a promise
      if (obj.x > 3 && obj.x <= 10) { 
        return GET('http://localhost:3003/objs/' + obj.id).then(function(body) {
          return body;
        });
      }
    }),
    res // stream to the client
  );

});

app.listen(3000);
```

# API
## map
```javascript
ee.map(fromType, f)
```
Apply the function f on each chunk giving it the chunk as a 'fromType'.

fromType: ee.bin || ee.str || ee.obj
f: function(chunk) with type of chunk is fromType




