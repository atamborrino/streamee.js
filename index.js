'use strict';
var stream = require('stream');
var _ = require('underscore');
var Q = require('q');
var util = require('util');

exports.map = Map;
exports.collect = Map;
exports.filter = Filter;
exports.pipeAndRun = pipeAndRun;
exports.interleave = Interleave;
exports.flattenReadable = FlattenReadable;
exports.encode = Encode;
exports.concatenate = Concatenate;

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

util.inherits(Map, stream.Transform);

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
        traceError(chunk, err);
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
    traceError(chunk, err);
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

util.inherits(Filter, stream.Transform);

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
        traceError(chunk, err);
        done();
      })
      .done(); 
    } else {
      if (filtered) self.push(chunk)
      done();
    }
  } catch (err) {
    traceError(chunk, err);
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

util.inherits(Interleave, stream.Transform);

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

util.inherits(FlattenReadable, stream.Transform);

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

util.inherits(Encode, stream.Transform);

Encode.prototype._transform = function(chunk, encoding, done) {
  try {
    if (Buffer.isBuffer) this.push(new Buffer(chunk.toString(this.from)), this.to)
    else this.push(new Buffer(chunk, this.to));
  } catch (err) {
    traceError(chunk, err);
  } finally {
    done();
  }
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

// concatenate
function Concatenate(streams) {
  if (!(this instanceof Concatenate))
    return new Concatenate(streams);
  stream.Transform.call(this, {objectMode: true});

  this.streams = streams;
  this.currentNb = -1;
  var self = this;

  function loop() {
    self.currentNb++;
    if (self.currentNb === self.streams.length) {
      self.push(null);
    } else {
      self.currentStream = self.streams[self.currentNb];
      self.currentStream.pipe(self, {end: false});
      self.currentStream.on('end', loop);
    } 
  }

  loop();
}

util.inherits(Concatenate, stream.Transform);

Concatenate.prototype._transform = function(chunk, encoding, done) {
  if (chunk) this.push(chunk)
  done();
}


/*
 * UTILS
 */

function isPromise(p) {
  return _.isObject(p) && p.toString().slice(8, -1) === 'Promise';
}

function traceError(chunk, error) {
  console.error('Error: "' + error + '"" happened while processing chunk: ' + chunk);
}

