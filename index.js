'use strict';
var stream = require('stream');
var _ = require('underscore');
var Q = require('q');

exports.map = Map;
exports.collect = Map;
exports.filter = Filter;
exports.pipeAndRun = pipeAndRun;
exports.interleave = Interleave;
exports.flattenReadable = FlattenReadable;
exports.encode = Encode;

var bin = exports.bin = 'bin';
var str = exports.str = 'str';
var obj = exports.obj = 'obj';

var default_encoding = 'utf8';

// map
function Map(fromType, f) {
  if (!(this instanceof Map))
    return new Map(fromType, f);
  
  stream.Transform.call(this, {objectMode: true});

  this.from = fromType;
  this.f = f;
}

Map.prototype = Object.create(
  stream.Transform.prototype, { constructor: { value: Map }});

Map.prototype._transform = function(chunk, encoding, done) {
  var self = this;
  try {
    var mapped;
    if (self.from === bin) {
      if (Buffer.isBuffer(chunk)) mapped = self.f(chunk)
      else mapped = self.f(new Buffer(chunk, default_encoding));
    } else if (self.from === str) {
      if (Buffer.isBuffer(chunk)) mapped = self.f(chunk.toString(default_encoding))
      else mapped = self.f(chunk);
    } else if (self.from === obj) {
      if (Buffer.isBuffer(chunk)) mapped = self.f(JSON.parse(chunk.toString(default_encoding)))
      else mapped = self.f(JSON.parse(chunk));
    }

    if (isPromise(mapped)) {
      mapped.then(function(value) {
        if (Buffer.isBuffer(value) || _.isString(value)) self.push(value)
        else self.push(JSON.stringify(value));
        done();
      }, function(err) {
        console.error(errorMessage(chunk, err));
        done();
      })
      .done(); 
    } else {
      if (!_.isUndefined(mapped)) {
        if (Buffer.isBuffer(mapped) || _.isString(mapped)) self.push(mapped)
        else self.push(JSON.stringify(mapped));
      }
      done();
    }
  } catch (err) {
    console.error(errorMessage(chunk, err));
    done();
  }

};


// filter
function Filter(fromType, f) {
  if (!(this instanceof Filter))
    return new Filter(fromType, f);

  stream.Transform.call(this, {objectMode: true});

  this.from = fromType;
  this.f = f;
}

Filter.prototype = Object.create(
  stream.Transform.prototype, { constructor: { value: Filter }});

Filter.prototype._transform = function(chunk, encoding, done) {
  var self = this;
  try {
    var filtered;
    if (self.from === bin) {
      if (Buffer.isBuffer(chunk)) filtered = self.f(chunk)
      else filtered = self.f(new Buffer(chunk, default_encoding));
    } else if (self.from === str) {
      if (Buffer.isBuffer(chunk)) filtered = self.f(chunk.toString(default_encoding))
      else filtered = self.f(chunk);
    } else if (self.from === obj) {
      if (Buffer.isBuffer(chunk)) filtered = self.f(JSON.parse(chunk.toString(default_encoding)))
      else filtered = self.f(JSON.parse(chunk));
    }

    if (isPromise(filtered)) {
      filtered.then(function(value) {
        if (value) self.push(chunk)
        done();
      }, function(err) {
        console.error(errorMessage(chunk, err));
        done();
      })
      .done(); 
    } else {
      if (filtered) self.push(chunk)
      done();
    }
  } catch (err) {
    console.error(errorMessage(chunk, err));
    done();
  }
};

// interleave
function Interleave(streams) {
  if (!(this instanceof Interleave))
    return new Interleave(streams);
  stream.Transform.call(this, {objectMode: true});
  
  var self = this;
  self.streams = streams;
  self.nActiveStreams = streams.length;
  _.each(self.streams, function(stream) {
    stream.pipe(self, {end: false});
    stream.on('end', function() {
      self.nActiveStreams--;
      if (self.nActiveStreams === 0) self.push(null); // end
    });
  });

}

Interleave.prototype = Object.create(
  stream.Transform.prototype, { constructor: { value: Interleave }});

Interleave.prototype._transform = function(chunk, encoding, done) {
  if (chunk) this.push(chunk);
  done();
}

// FlattenReadable
function FlattenReadable(promiseStream) {
  if (!(this instanceof FlattenReadable))
    return new FlattenReadable(promiseStream);
  stream.Transform.call(this, {objectMode: true});

  var self = this;
  self.promiseStream = promiseStream;
  self.promiseStream.then(function(readable) {
    self.stream = readable;
    readable.pipe(self);
  }, function(err) {
    console.error('Promise[Readable] filled with error: ' + err);
    self.push(null);
  })
  .done();
}

FlattenReadable.prototype = Object.create(
  stream.Transform.prototype, { constructor: { value: FlattenReadable }});

FlattenReadable.prototype._transform = function(chunk, encoding, done) {
  if (chunk) this.push(chunk);
  done();
}


// Encode
function Encode(from, to) {
  if (!(this instanceof Encode))
    return new Encode(from, to);
  stream.Transform.call(this, {objectMode: true});

  this.from = from;
  this.to = to;
}

Encode.prototype = Object.create(
  stream.Transform.prototype, { constructor: { value: Encode }});

Encode.prototype._transform = function(chunk, encoding, done) {
  if (Buffer.isBuffer) this.push(new Buffer(chunk.toString(this.from)), this.to)
  else this.push(new Buffer(chunk, this.to));
  done();
}


// pipeAndRun
function pipeAndRun() {
  var pipeline;
  if (arguments.length >= 1) {
    pipeline = arguments[0];
    for (var i = 1; i < arguments.length; ++i) {
      pipeline = pipeline.pipe(arguments[i]);
    };
  }
  return pipeline;
}


/*
 * UTILS
 */

function isPromise(p) {
  return _.isObject(p) && p.toString().slice(8, -1) === 'Promise';
}

function errorMessage(chunk, error) {
  return 'Error: "' + error + '"" happened while processing chunk: ' + chunk;
}
