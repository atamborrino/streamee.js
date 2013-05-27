# streamee.js

Streamee.js is a set of stream transformers and composers for node.js that integrates seamlessly with [Q promises](https://github.com/kriskowal/q). It can be seen as a mix of [async](https://github.com/caolan/async) and [underscore.js](http://underscorejs.org/), but for streams!

One of the most useful feature of streams is **back-pressure**: if the bottom of the stream pipeline is slow (for example the Web client), then the top will automatically push slowly (for example your database and/or Web server), so that the memory consumption is optimal in node.  
streamee.js allows you to build very easily pipelines that compose and transform streams, so that you can keep back-pressure all the way long in a nice functional programming style. All transformation functions can return **Q promises** instead of direct values, which makes asynchronous operations less verbose and more functional (less callback hell!).

Example:
```js
var ee = require('streamee');

var stream1 = // Readable stream, for example from a HTTP chunked response, a MongoDB response, ...
var promiseOfStream = // sometimes, because of callbacks, we can only get a Q.Promise[Readable] instead of a Readable
var stream2 = ee.flattenReadable(promiseOfStream) // well, now you can flatten it!

ee.pipeAndRun( // create a pipeline
  ee.interleave([stream1, stream2]), // interleave the streams
  ee.map(ee.obj, function(obj) { // 'ee.obj' means that we want to handle the chunk as a json object
    obj.newField = 'something useful'
    return obj; // return directly a value, so this is a sync map
  }),
  ee.collect(ee.obj, function(obj) { // collect is filter + map
    if (obj.intField > 3 && obj.intField < 10) { // filter
      return getPromiseOfData(obj); // async map by returning a Q promise. The promise can contain either an object 
    }                               // or a string or a buffer
  }),
  destination // Writable stream, for example a HTTP chunked response toward a Web client or a Websocket connection
);
```

Inspired from [Play Framework Enumeratee](http://www.playframework.com/documentation/2.1.1/Enumeratees).

## Installation

## Integrate with other APIs that return streams
Streamee.js uses node 1.0+ streams, so if you use an API that returns node 0.8 streams, you have to wrap them like this:
```js
var stream = require('stream');
var newStream = new stream.Readable().wrap(oldStream);
```

If each chunk of your stream is a logical independent unit (for example a stream of json strings),
you should create an 'objectMode' stream so that node's stream buffers does not automatically concatenate the chunks:
```js
var objectModeStream = new stream.Readable({objectMode: true}).wrap(nonObjectModeStream);
```

For example, here is a function that returns a chunked http response as an objectMode stream:
```js
var http = require('http');
var Q = require('q');

// GET a http chunked stream (for example a stream of json strings)
function GETstream(url) {
  var deferred = Q.defer();
  http.get(url, function(res) { 
    deferred.resolve(new stream.Readable({objectMode: true}).wrap(res));
  });
  return ee.flattenReadable(deferred.promise); // flatten a Promise[stream.Readable] to a stream.Readable
}
```

## API
All transformers (map, filter, collect...) take as first parameter the type in which you want to handle the chunk in the transformation function. ```ee.bin``` is buffer (binary data), ```ee.str``` is string and ```ee.obj``` is an object. If a chunk is not
convertible to the asked type, it will be dropped.

Also, all transformation functions can return either buffer or string or object, as well as Promise[string] or
Promise[buffer] or Promise[object].

Default encoding for all transformers is utf8. If a source or a destination has a different encoding, you can use 
```ee.encode(fromEncoding, toEncoding)``` at the begin or the end of the stream pipeline.

---------------------------------------

### ee.map(fromType, f)
Map each chunk.

**Arguments**
*  fromType: ee.bin | ee.str | ee.obj
*  f: function(chunk) - Must return the mapped chunk or a Promise of it

**Example**
```js
ee.map(ee.str, function(str) {
  return str + ' is mapped to this message';
})
```

**Example with a promise**
```js
var request = require('request');

// Helper function that does a http GET request and returns a promise of the response body
function GET(url) {
  var deferred = Q.defer();
  request(url, function(err, res, body) {
    if (!err && res.statusCode == 200) deferred.resolve(body)
    else deferred.reject(err);
  });
  return deferred.promise;
}

ee.map(ee.obj, function(obj) {
  return GET(obj.url).then(function(body) {
    return obj + ' is mapped to ' + body;
  });
})
```

---------------------------------------

### ee.filter(fromType, f)
Keep only the chunks that pass the truth test f.

**Arguments**
*  fromType: ee.bin | ee.str | ee.obj
*  f: function(chunk) - Must return a boolean value (indicating if the chunk is kept in the stream) or a Promise of it.

**Example**
```js
ee.map(ee.obj, function(obj) {
  return obj.aField === 'someValue';
})
```

---------------------------------------

### ee.collect(fromType, f)
Collect is filter + map.

**Arguments** 
*  fromType: ee.bin | ee.str | ee.obj
*  f: function(chunk) - For each chunk, if a value (or a Promise of it) is returned by f, then this chunk is kept in
the stream and mapped to the returned value (or the value inside the Promise). If the function does not return (or return 
undefined), the chunk is not kept.

**Example**
```js
ee.collect(ee.str, function(str) {
  if (str.length > 10) return 'We keep ' + str + ' and map it to this message';
})
```

---------------------------------------

### ee.encode(fromEncoding, toEncoding)
Encode the chunks that were encoded in 'fromEncoding' to 'toEncoding'.

**Example**
```js
var utf8stream = ee.encode('utf16le', 'utf8');
```

---------------------------------------

### ee.interleave(arrayOfReadableStreams)
Interleave the readable streams passed in the array.

**Example**
```js
var mixedStream = ee.interleave([stream1, stream2]);
```

---------------------------------------

### ee.flattenReadable(readable)
Flatten a Q.Promise[Readable] to a Readable stream.

**Example**
```js
var aStream = ee.flattenReadable(promiseOfReadableStream);
```

---------------------------------------

### ee.pipeAndRun(streams*)
Take the streams passed in parameter and sequentially pipe them. Equivalent to stream1.pipe(stream2).pipe(...) ...

**Example**
```js
ee.pipeAndRun(
  srcStream,
  ee.map(ee.obj, function(obj) {
    var mappedObj = // ...
    return mappedObj;
  }),
  destinationStream
);
```

---------------------------------------

### More to come!

## License
This software is licensed under the Apache 2 license, quoted below.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
