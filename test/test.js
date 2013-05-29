'use strict';
var should = require('should');
var stream = require('stream');
var _ = require('underscore');
var Q = require('q');

var ee = require('..');

function WritableMock(sink, options, obj) {
  if (!(this instanceof WritableMock))
    return new WritableMock(f, options);

  stream.Writable.call(this, options);
  this.sink = sink;
  this.obj = obj === 'obj' ? true : false;
}

WritableMock.prototype = Object.create(
  stream.Writable.prototype, { constructor: { value: WritableMock }});

WritableMock.prototype._write = function(chunk, encoding, done) {
  if (this.obj) {
    this.sink.push(JSON.parse(chunk))
  } else {
    this.sink.push(chunk);
  }
  done();
};

function ReadableMock(chunks, options, obj) {
  if (!(this instanceof ReadableMock))
    return new ReadableMock(chunks, options);

  stream.Readable.call(this, options);
  this.obj = obj === 'obj' ? true : false;
  this.chunks = chunks;
  this.i = -1;
}

ReadableMock.prototype = Object.create(
  stream.Readable.prototype, { constructor: { value: ReadableMock }});

ReadableMock.prototype._read = function() {
  this.i++;
  if (this.i < this.chunks.length) {
    if (this.obj) {
      this.push(JSON.stringify(this.chunks[this.i]));
    } else {
      this.push(this.chunks[this.i]);
    }
  } else {
    this.push(null);
  }
};

var chunks, read, write, sink;
var chunksObj, readObj, readObj2, writeObj, sinkObj;
var chunksBin, readBin, writeBin, sinkBin;

beforeEach(function() {
  // string
  chunks = ['Hello', 'node', 'js'];
  read = new ReadableMock(chunks, {encoding: 'utf8', objectMode: true});
  sink = [];
  write = new WritableMock(sink, {decodeStrings: false});

  // binary
  chunksBin = [new Buffer([ 8, 6, 7, 5, 3, 0, 9]), new Buffer([ 8, 1, 7, 4, 3, 0, 3])];
  readBin = new ReadableMock(chunksBin);    
  sinkBin = [];
  writeBin = new WritableMock(sinkBin);

  //obj
  chunksObj = [{data: 'data1', val: 3}, {data: 'data2', val:5}];
  readObj = new ReadableMock(chunksObj, {encoding: 'utf8', objectMode: true}, 'obj');
  readObj2 = new ReadableMock(chunksObj, {encoding: 'utf8', objectMode: true}, 'obj');
  sinkObj = [];
  writeObj = new WritableMock(sinkObj, {decodeStrings: false}, 'obj');
})

describe('Map', function() {
  it('should map a string stream', function(done) {
    var mapper = function(chunk) {return chunk + "ok";};
    read.pipe(ee.map(ee.str, mapper)).pipe(write).on('finish', function() {
      _.map(chunks, mapper).should.eql(sink);
      done();
    });
  })

  it('should map a binary stream', function(done) {
    var mapper = function(chunk) {return chunk;};
    readBin.pipe(ee.map(ee.bin, mapper)).pipe(writeBin).on('finish', function() {
      _.map(chunksBin, mapper).should.eql(sinkBin);
      done();
    });
  })

  it('should map a obj stream', function(done) {
    var mapper = function(chunk) {chunk.data = 'newData'; return chunk;};
    readObj.pipe(ee.map(ee.obj, mapper)).pipe(writeObj).on('finish', function() {
      _.map(chunksObj, mapper).should.eql(sinkObj);
      done();
    });
  })

  it('should async map a obj stream', function(done) {
    var mapperAsync = function(chunk) {
      return Q.fcall(function() {
        chunk.data = 'newData'; 
        return chunk;
      });
    };
    var mapper = function(chunk) {
        chunk.data = 'newData'; 
        return chunk;
    };
    readObj.pipe(ee.map(ee.obj, mapperAsync)).pipe(writeObj).on('finish', function() {
      _.map(chunksObj, mapper).should.eql(sinkObj);
      done();
    });
  })
})

describe('Filter', function() {
  it('should filter a obj stream', function(done) {
    var filter = function(c) {return c.val === 3;};
    readObj.pipe(ee.filter(ee.obj, filter, ee.obj)).pipe(writeObj).on('finish', function() {
      _.filter(chunksObj,filter).should.eql(sinkObj);
      done();
    });
  })
})

describe('Flatten', function() {
  it('should flatten a readable stream', function(done) {
    var pStream = Q.fcall(function() {
      return read;
    });
    var stream = ee.flattenReadable(pStream);
    stream.pipe(write).on('finish', function() {
      chunks.should.eql(sink);
      done();
    });
  })
})

describe('PipeAndRun', function() {
  it('should pipeline', function(done) {
    ee.pipeAndRun(
      readObj,
      ee.collect(ee.obj, function(obj) {
        if (obj.val > 4) {
          return Q.fcall(function() {
            return obj.data;
          });
        }
      }),
      write
    );
    write.on('finish', function() {
      sink.should.have.length(1);
      (sink[0]).should.equal('data2');
      done();
    });
  })
})

describe('Concatenate', function() {
  it('should concatenate streams', function(done) {
    ee.concatenate([readObj, readObj2]).pipe(writeObj).on('finish', function() {
      sinkObj.should.eql(chunksObj.concat(chunksObj));
      done();
    });
  })
})

describe('Interleave', function() {
  it('should concatenate streams', function(done) {
    ee.interleave([readObj, readObj2]).pipe(writeObj).on('finish', function() {
      sinkObj.sort().should.eql(chunksObj.concat(chunksObj).sort());
      done();
    });
  })
})

describe('SplitStr', function() {
  it('should split strings', function(done) {
    read.pipe(ee.splitStr('o')).pipe(write).on('finish', function() {
      sink.should.eql(_.compact(chunks.join('').split('o')));
      done();
    });
  })
})

describe('Encode', function() {
  it('should encode the stream from utf16-LE to utf8', function(done) {
    var utf16 = _.map(chunks, function(chunk) {
      return new Buffer(chunk, 'utf16le');
    });
    var utf8 = _.map(chunks, function(chunk) {
      return new Buffer(chunk, 'utf8');
    });
    var readUtf16 = new ReadableMock(utf16);
    readUtf16.pipe(ee.encode('utf16le', 'utf8')).pipe(write).on('finish', function() {
      sink.should.eql(utf8);
      done();
    });
  })
})
