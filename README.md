# streamee.js

streamee.js is a set of stream transformers and composers for node.js that integrates seamlessly with Q promises. It can be seen as a mix of async and underscore.js,
but for streams!

One of the most useful feature of streams is **back-pressure**: if the bottom of the stream pipeline is slow (for example the Web client), then the top will automatically push slowly (for example your database and/or Web server), so that the memory consumption is optimal in node.  
streamee.js allows you to build very easily pipelines that compose and transform streams, so that you can keep back-pressure all the way long in a nice functional programming style (less callback hell!). All transformation functions can return **Q promises** instead of direct value, which makes asynchronous operations less verbose and more functional.

Example
```javascript
var stream1 = // Readable stream for example from a HTTP chunked response, a MongoDB response, ...
var stream2 = // another readable stream

var promiseOfStream = // sometimes, because of callbacks, we can only get a Q Promise[Readable] instead of a Readable
var stream3 = ee.flattenReadable(promiseOfStream) // well, now you can flatten it!

ee.pipeAndRun( // create a pipeline
  ee.interleave([stream1, stream2, stream3]), // interleave the streams
  ee.map(ee.obj, function(obj) { // ee.obj' means that we want to handle the chunk as a json object
    obj.newField = 'something useful'
    return obj; // return directly a value, so this is a sync map
  }),
  ee.collect(ee.obj, function(obj) { // collect is filter + map
    if (obj.intField > 3 && obj.intField < 10) { // filter
      return getPromiseOfData(obj); // async map by returning a Q promise. The promise can contain either an object or 
    }                               // a string or a buffer
  }),
  destination // Writable stream, for example a HTTP chunked response toward a Web client or a Websocket connection
);
```

Inspired from [Play Framework Enumeratee](http://www.playframework.com/documentation/2.1.1/Enumeratees).

## Installation

## Integrating with other APIs that return streams
streamee.js uses node 1.0+ streams, so if you use an API that returns node 0.8 streams, you have to wrap them like this:
```javascript
var stream = require('stream');
var newStream = new stream.Readable().wrap(oldStream);
```

If each chunk of your stream is a logical independent unit (for example a stream of json strings),
you should create an 'objectMode' stream so that node's stream buffers does not automatically concatenate the chunks:
```javascript
var objectStream = new stream.Readable({objectMode: true}).wrap(nonObjectStream);
```

For example, here is a function that returns a stream of chunked http response:
```javascript
var http = require('http');

// GET a http chunked stream (for example a stream of json objects)
function GETstream(url) {
  var deferred = Q.defer();
  http.get(url, function(res) { 
    deferred.resolve(new stream.Readable({objectMode: true}).wrap(res));
  });
  return ee.flattenReadable(deferred.promise); // flatten a Promise[stream.Readable] to a stream.Readable
}
```

# API
All transformers (map, filter, collect...) take as first parameter the type in which you want to handle the chunk in the transformation function. ```ee.bin``` is buffer (binary data), ```ee.str``` is string and ```ee.obj``` is an object. If a chunk is not
convertible to the asked type, it will be dropped.

Also, all transformation functions can return either buffer or string or object, as well as Promise[string] or
Promise[buffer] or Promise[object].

Default encoding for all transformers is utf8. If a source or a destination has a different encoding, you can use 
```ee.encode(fromEncoding, toEncoding)``` at the begin or the end of the stream pipeline.

### map(fromType, f)
f: function(chunk) Must return the mapped chunk or a Promise of it

### filter(fromType, f)
f: function(chunk) Must return a boolean value (*true* if we keep the chunk, *false* otherwise) or a Promise of it.

### collect(from)
Collect is filter + map.
f: function(chunk) f is a partially applied function (return a value )






