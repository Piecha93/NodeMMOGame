(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
arguments[4][1][0].apply(exports,arguments)
},{"dup":1}],3:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; i++) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  that.write(string, encoding)
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

function arrayIndexOf (arr, val, byteOffset, encoding) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var foundIndex = -1
  for (var i = 0; byteOffset + i < arrLength; i++) {
    if (read(arr, byteOffset + i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
      if (foundIndex === -1) foundIndex = i
      if (i - foundIndex + 1 === valLength) return (byteOffset + foundIndex) * indexSize
    } else {
      if (foundIndex !== -1) i -= i - foundIndex
      foundIndex = -1
    }
  }
  return -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  if (Buffer.isBuffer(val)) {
    // special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(this, val, byteOffset, encoding)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset, encoding)
  }

  throw new TypeError('val must be string, number or Buffer')
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; i++) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; i++) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":4,"ieee754":5,"isarray":6}],4:[function(require,module,exports){
'use strict'

exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

function init () {
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

init()

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],5:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],6:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],7:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ChatHtmlHandler_1 = require("./graphic/HtmlHandlers/ChatHtmlHandler");
const SocketMsgs_1 = require("../shared/net/SocketMsgs");
class Chat {
    constructor(socket) {
        this.socket = socket;
        this.socket.on(SocketMsgs_1.SocketMsgs.CHAT_MESSAGE, (data) => {
            this.chatHtmlHandler.append(data['s'], data['m']);
        });
        this.chatHtmlHandler = ChatHtmlHandler_1.ChatHtmlHandler.Instance;
        this.chatHtmlHandler.setSubmitCallback(this.sendMessage.bind(this));
    }
    sendMessage(text) {
        this.socket.emit(SocketMsgs_1.SocketMsgs.CHAT_MESSAGE, text);
    }
}
exports.Chat = Chat;

},{"../shared/net/SocketMsgs":115,"./graphic/HtmlHandlers/ChatHtmlHandler":15}],9:[function(require,module,exports){
"use strict";
/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const Renderer_1 = require("./graphic/Renderer");
const InputHandler_1 = require("./input/InputHandler");
const HeartBeatSender_1 = require("./net/HeartBeatSender");
const SocketMsgs_1 = require("../shared/net/SocketMsgs");
const Chat_1 = require("./Chat");
const InputSender_1 = require(".//net/InputSender");
const DeltaTimer_1 = require("../shared/utils/DeltaTimer");
const DebugWindowHtmlHandler_1 = require("./graphic/HtmlHandlers/DebugWindowHtmlHandler");
const Cursor_1 = require("./input/Cursor");
const Transform_1 = require("../shared/game_utils/physics/Transform");
const AverageCounter_1 = require("../shared/utils/AverageCounter");
const GameCore_1 = require("../shared/GameCore");
const GameObjectsManager_1 = require("../shared/game_utils/factory/GameObjectsManager");
const Reconciliation_1 = require("./Reconciliation");
const TicksCounter_1 = require("../shared/utils/TicksCounter");
const customParser = require('socket.io-msgpack-parser');
const io = require('socket.io-client');
class GameClient {
    constructor() {
        this.fpsAvgCounter = new AverageCounter_1.AverageCounter(30);
        this.localPlayer = null;
        this.localPlayerId = "";
        this.timer = new DeltaTimer_1.DeltaTimer;
        this.tickCounter = TicksCounter_1.TicksCounter.Instance;
        this.connect();
        this.inputSender = new InputSender_1.InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender_1.HeartBeatSender(this.socket);
        this.chat = new Chat_1.Chat(this.socket);
        this.renderer = new Renderer_1.Renderer(() => {
            this.renderer.createHUD();
            this.socket.emit(SocketMsgs_1.SocketMsgs.CLIENT_READY);
        });
    }
    connect() {
        this.socket = io({
            reconnection: false,
            parser: customParser
        });
        if (this.socket != null) {
            this.configureSocket();
        }
        else {
            throw new Error("Cannot connect to server");
        }
    }
    startGameLoop() {
        this.core.gameLoop();
        this.renderer.setCurrentChunk(this.core.ChunksManager.getObjectChunk(this.localPlayer));
        this.renderer.update();
        this.updateDebugWindow();
        let deviation = this.renderer.CameraDeviation;
        this.cursor.move(this.localPlayer.Transform.X + deviation[0], this.localPlayer.Transform.Y + deviation[1]);
        this.core.CollisionsSystem.updateCollisionsForGameObject(this.cursor);
        this.tickCounter.update();
        requestAnimationFrame(this.startGameLoop.bind(this));
    }
    configureSocket() {
        this.socket.on(SocketMsgs_1.SocketMsgs.INITIALIZE_GAME, (data) => {
            this.onInitializeGame(data);
        });
        this.socket.on(SocketMsgs_1.SocketMsgs.FIRST_UPDATE_GAME, (data) => {
            this.onFirstUpdate(data);
        });
        this.socket.on(SocketMsgs_1.SocketMsgs.UPDATE_SNAPSHOT_DATA, (lastSnapshotData) => {
            this.onUpdateSnapshotData(lastSnapshotData);
        });
        this.socket.on(SocketMsgs_1.SocketMsgs.UPDATE_GAME, (data) => {
            this.onServerUpdate(data);
        });
        this.socket.on(SocketMsgs_1.SocketMsgs.CHUNK_CHANGED, (chunkPosition) => {
            this.onChunkMoved(chunkPosition);
        });
        this.socket.on(SocketMsgs_1.SocketMsgs.ERROR, (errorMessage) => {
            console.log("Server error: " + errorMessage);
        });
    }
    onInitializeGame(data) {
        this.localPlayerId = data['id'];
        this.reconciliation = new Reconciliation_1.Reconciliation();
        this.core = new GameCore_1.GameCore();
        this.cursor = new Cursor_1.Cursor(new Transform_1.Transform([1, 1], 1)); //GameObjectsFactory.InstatiateManually(new Cursor(new Transform([1,1],1))) as Cursor;
        this.core.CollisionsSystem.insertObject(this.cursor);
        this.heartBeatSender.sendHeartBeat();
        this.inputHandler = new InputHandler_1.InputHandler(this.cursor);
        this.inputHandler.addSnapshotCallback((snapshot) => {
            if (this.localPlayer) {
                this.reconciliation.pushSnapshotToHistory(snapshot);
                this.inputSender.sendInput(snapshot);
                this.localPlayer.setInput(snapshot);
            }
        });
    }
    onFirstUpdate(data) {
        this.onServerUpdate(data);
        this.localPlayer = GameObjectsManager_1.GameObjectsManager.GetGameObjectById(this.localPlayerId);
        this.renderer.FocusedObject = this.localPlayer;
        this.startGameLoop();
    }
    onServerUpdate(update) {
        for (let i = 0; i < update.length; i++) {
            this.core.decodeUpdate(update[i][1]);
        }
        if (this.localPlayer) {
            this.reconciliation.reconciliation(this.localPlayer, this.core.CollisionsSystem);
        }
        if (this.coreChunk) {
            this.clearUnusedChunks(this.coreChunk);
        }
    }
    onUpdateSnapshotData(lastSnapshotData) {
        this.reconciliation.LastServerSnapshotData = lastSnapshotData;
    }
    onChunkMoved(chunkPosition) {
        this.coreChunk = this.core.ChunksManager.Chunks[chunkPosition[0]][chunkPosition[1]];
    }
    updateDebugWindow() {
        let delta = this.timer.getDelta();
        let deltaAvg = this.fpsAvgCounter.calculate(delta);
        DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.Fps = (1000 / deltaAvg).toFixed(2).toString();
        DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.GameObjectCounter = GameObjectsManager_1.GameObjectsManager.gameObjectsMapById.size.toString();
        DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.Position = "x: " + this.localPlayer.Transform.X.toFixed(2) +
            " y: " + this.localPlayer.Transform.Y.toFixed(2);
    }
    clearUnusedChunks(coreChunk) {
        let coreChunks = [coreChunk];
        coreChunks = coreChunks.concat(coreChunk.Neighbors);
        let chunk;
        let chunksIter = this.core.ChunksManager.ChunksIterator();
        while (chunk = chunksIter.next().value) {
            if (coreChunks.indexOf(chunk) == -1) {
                chunk.clearAll();
            }
        }
    }
}
exports.GameClient = GameClient;

},{"../shared/GameCore":86,"../shared/game_utils/factory/GameObjectsManager":93,"../shared/game_utils/physics/Transform":112,"../shared/net/SocketMsgs":115,"../shared/utils/AverageCounter":121,"../shared/utils/DeltaTimer":122,"../shared/utils/TicksCounter":123,".//net/InputSender":27,"./Chat":8,"./Reconciliation":10,"./graphic/HtmlHandlers/DebugWindowHtmlHandler":16,"./graphic/Renderer":19,"./input/Cursor":22,"./input/InputHandler":23,"./net/HeartBeatSender":26,"socket.io-client":70,"socket.io-msgpack-parser":77}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ChangesDict_1 = require("../shared/serialize/ChangesDict");
class Reconciliation {
    constructor() {
        this.inputHistory = [];
    }
    pushSnapshotToHistory(inputSnapshot) {
        this.lastInputSnapshot = inputSnapshot;
        if (this.inputHistory.indexOf(inputSnapshot) == -1) {
            this.inputHistory.push(inputSnapshot);
        }
    }
    reconciliation(player, collisionsSystem) {
        if (this.lastServerSnapshotData == null) {
            return;
        }
        let serverSnapshotId = this.lastServerSnapshotData[0];
        let serverSnapshotDelta = this.lastServerSnapshotData[1];
        let histElemsToRemove = 0;
        for (let i = 0; i < this.inputHistory.length; i++) {
            if (this.inputHistory[i].ID < serverSnapshotId) {
                histElemsToRemove++;
                continue;
            }
            let delta = 0;
            if (i < this.inputHistory.length - 1) {
                delta = this.inputHistory[i + 1].CreateTime - this.inputHistory[i].CreateTime;
            }
            else {
                delta = this.inputHistory[i].SnapshotDelta;
            }
            if (this.inputHistory[i].ID == serverSnapshotId) {
                delta -= serverSnapshotDelta;
            }
            player.setInput(this.inputHistory[i]);
            let stepSize = 40;
            let steps = Math.floor(delta / stepSize);
            let rest = delta % stepSize;
            for (let i = 0; i <= steps; i++) {
                let step;
                if (i == steps) {
                    step = rest;
                }
                else {
                    step = stepSize;
                }
                let moveFactors = player.parseMoveDir();
                if (player.Transform.DeserializedFields.has(ChangesDict_1.ChangesDict.X)) {
                    player.Transform.X += moveFactors[0] * player.Velocity * step;
                }
                if (player.Transform.DeserializedFields.has(ChangesDict_1.ChangesDict.Y)) {
                    player.Transform.Y += moveFactors[1] * player.Velocity * step;
                }
                collisionsSystem.updateCollisionsForGameObject(player);
            }
        }
        this.inputHistory = this.inputHistory.splice(histElemsToRemove);
        this.lastServerSnapshotData = null;
    }
    set LastServerSnapshotData(lastSnapshotData) {
        this.lastServerSnapshotData = lastSnapshotData;
    }
}
exports.Reconciliation = Reconciliation;

},{"../shared/serialize/ChangesDict":116}],11:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const Renderer_1 = require("../graphic/Renderer");
class Camera extends PIXI.Container {
    constructor(follower) {
        super();
        this.dt = 0.8;
        this.mouseDeviationX = 0;
        this.mouseDeviationY = 0;
        this.deviationRate = 6;
        this.Follower = follower;
        this.position.set(Renderer_1.Renderer.WIDTH / 2, Renderer_1.Renderer.HEIGHT / 2);
        window.addEventListener("mousemove", this.onMouseMove.bind(this));
    }
    onMouseMove(event) {
        let canvas = document.getElementById("game-canvas");
        let rect = canvas.getBoundingClientRect();
        this.mouseDeviationX = (event.x - rect.left - Renderer_1.Renderer.WIDTH / 2) / this.deviationRate;
        this.mouseDeviationY = (event.y - rect.top - Renderer_1.Renderer.HEIGHT / 2) / this.deviationRate;
    }
    set Follower(follower) {
        this.follower = follower;
        this.pivot = new PIXI.Point(follower.x, follower.y);
        this.update();
    }
    update() {
        this.pivot.x += (this.follower.x + this.mouseDeviationX - this.pivot.x) * this.dt;
        this.pivot.y += (this.follower.y + this.mouseDeviationY - this.pivot.y) * this.dt;
    }
    get MouseDeviation() {
        return [this.mouseDeviationX * (this.deviationRate + 1), this.mouseDeviationY * (this.deviationRate + 1)];
    }
}
exports.Camera = Camera;

},{"../graphic/Renderer":19}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectRender_1 = require("./GameObjectRender");
const ResourcesLoader_1 = require("../graphic/ResourcesLoader");
class GameObjectAnimationRender extends GameObjectRender_1.GameObjectRender {
    constructor() {
        super();
        this.lastDirectionKey = "D";
    }
    setObject(gameObject) {
        super.setObject(gameObject);
        this.animation = new PIXI.extras.AnimatedSprite(this.getAnimationTextures());
        this.updateAnimationTextures();
        this.addChild(this.animation);
        this.animation.animationSpeed = 0.2;
        this.animation.play();
        this.animation.width = this.objectRef.Transform.ScaleX;
        this.animation.height = this.objectRef.Transform.ScaleY;
        this.animation.anchor.set(0.5, 0.5);
    }
    update() {
        super.update();
        this.updateAnimationTextures();
        this.animation.width = this.objectRef.Transform.ScaleX;
        this.animation.height = this.objectRef.Transform.ScaleY;
    }
    updateAnimationTextures() {
        this.animation.textures = this.getAnimationTextures();
    }
    getAnimationTextures() {
        let resource = ResourcesLoader_1.ResourcesLoader.Instance.getResource(this.objectRef.SpriteName);
        if (resource.type == ResourcesLoader_1.ResourceType.OCTAGONAL_ANIMATION) {
            let actor = this.objectRef;
            let resource = ResourcesLoader_1.ResourcesLoader.Instance.getResource(this.objectRef.SpriteName);
            this.lastDirectionKey = this.directonsToDirectionKey(actor.Horizontal, actor.Vertical);
            return resource.textures.get(this.lastDirectionKey);
        }
        else {
            return resource.textures.get(this.objectRef.SpriteName);
        }
    }
    directonsToDirectionKey(horizontal, vertical) {
        let dir = "";
        if (horizontal == -1) {
            dir += "U";
        }
        else if (horizontal == 1) {
            dir += "D";
        }
        if (vertical == -1) {
            dir += "L";
        }
        else if (vertical == 1) {
            dir += "R";
        }
        if (dir == "") {
            dir = this.lastDirectionKey;
        }
        return dir;
    }
    destroy() {
        super.destroy();
        this.animation.destroy();
    }
}
exports.GameObjectAnimationRender = GameObjectAnimationRender;

},{"../graphic/ResourcesLoader":20,"./GameObjectRender":13}],13:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
class GameObjectRender extends PIXI.Container {
    constructor() {
        super();
        this.dt = 0.25;
    }
    setObject(gameObjectReference) {
        this.objectRef = gameObjectReference;
    }
    update() {
        this.visible = !this.objectRef.Invisible;
        let transform = this.objectRef.Transform;
        let distance = Math.sqrt(Math.pow(transform.X - this.x, 2) + Math.pow(transform.Y - this.y, 2));
        if (distance > 200) {
            this.x = transform.X;
            this.y = transform.Y;
        }
        else {
            this.x = (transform.X - this.x) * this.dt + this.x;
            this.y = (transform.Y - this.y) * this.dt + this.y;
        }
        this.rotation = this.objectRef.Transform.Rotation;
    }
    destroy() {
        super.destroy();
    }
}
exports.GameObjectRender = GameObjectRender;

},{}],14:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectRender_1 = require("../graphic/GameObjectRender");
class GameObjectSpriteRender extends GameObjectRender_1.GameObjectRender {
    constructor() {
        super();
    }
    setObject(gameObjectReference) {
        this.objectRef = gameObjectReference;
        this.sprite = new PIXI.Sprite(PIXI.utils.TextureCache[this.objectRef.SpriteName]);
        this.addChild(this.sprite);
        this.sprite.width = this.objectRef.Transform.ScaleX;
        this.sprite.height = this.objectRef.Transform.ScaleY;
        this.sprite.anchor.set(0.5, 0.5);
    }
    update() {
        super.update();
        if (this.sprite.texture != PIXI.utils.TextureCache[this.objectRef.SpriteName]) {
            this.sprite.texture = PIXI.utils.TextureCache[this.objectRef.SpriteName];
        }
        this.sprite.width = this.objectRef.Transform.ScaleX;
        this.sprite.height = this.objectRef.Transform.ScaleY;
    }
    destroy() {
        super.destroy();
    }
}
exports.GameObjectSpriteRender = GameObjectSpriteRender;

},{"../graphic/GameObjectRender":13}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ChatHtmlHandler {
    constructor() {
        this.create();
    }
    static get Instance() {
        if (ChatHtmlHandler.instance) {
            return ChatHtmlHandler.instance;
        }
        else {
            ChatHtmlHandler.instance = new ChatHtmlHandler;
            return ChatHtmlHandler.instance;
        }
    }
    create() {
        ChatHtmlHandler.instance = this;
        this.chatInput = document.getElementById("chat-input");
        this.chatForm = document.getElementById("chat-form");
        this.chatForm.onsubmit = () => {
            if (this.chatInput.value != "") {
                this.callSubmitCallback(this.chatInput.value);
                this.chatInput.value = "";
            }
            this.chatInput.blur();
            return false;
        };
        document.addEventListener("keypress", (event) => {
            if (event.keyCode == 13) { //enter
                event.stopPropagation();
                this.chatInput.focus();
            }
        });
        this.chatInput.addEventListener("focusin", () => {
            //console.log("focusin" + this.chatForm.style);
            this.chatInput.style.color = "rgba(85, 85, 85, 1)";
        });
        this.chatInput.addEventListener("focusout", () => {
            //console.log("focusout" + this.chatForm.style);
            this.chatInput.style.color = "rgba(85, 85, 85, 0.1)";
        });
        let chatZone = document.getElementById("chat-zone");
        chatZone.addEventListener("mousedown", (event) => {
            return false;
        });
    }
    callSubmitCallback(text) {
        if (this.submitCallback) {
            this.submitCallback(text);
        }
    }
    setSubmitCallback(submitCallback) {
        this.submitCallback = submitCallback;
    }
    append(sender, message) {
        let htmlMessageeSender = document.createElement("span");
        htmlMessageeSender.id = "msg-sender";
        htmlMessageeSender.innerHTML = "<b>" + sender + "</b>: ";
        let htmlMessageeContent = document.createElement("span");
        htmlMessageeContent.id = "msg-content";
        htmlMessageeContent.textContent = message;
        let htmlMessagee = document.createElement("span");
        htmlMessagee.id = "chat-msg";
        htmlMessagee.appendChild(htmlMessageeSender);
        htmlMessagee.appendChild(htmlMessageeContent);
        htmlMessagee.appendChild(document.createElement("br"));
        let messagesDiv = document.getElementById("chat-msgs");
        messagesDiv.appendChild(htmlMessagee);
        if (messagesDiv.childNodes.length > 100) {
            messagesDiv.removeChild(messagesDiv.firstChild);
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}
exports.ChatHtmlHandler = ChatHtmlHandler;

},{}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DebugWindowHtmlHandler {
    constructor() {
        this.debugWindowDiv = document.getElementById("debug-window");
        this.pingSpan = document.createElement("span");
        this.fpsSpan = document.createElement("span");
        this.gameObjectCounterSpan = document.createElement("span");
        this.cursorObjectSpan = document.createElement("span");
        this.positionSpan = document.createElement("span");
        this.Ping = "";
        this.Fps = "";
        this.GameObjectCounter = "0";
        this.CursorObjectSpan = "";
        this.Position = "0";
        this.debugWindowDiv.appendChild(this.pingSpan);
        this.debugWindowDiv.appendChild(this.fpsSpan);
        this.debugWindowDiv.appendChild(this.gameObjectCounterSpan);
        this.debugWindowDiv.appendChild(this.cursorObjectSpan);
        this.debugWindowDiv.appendChild(this.positionSpan);
    }
    static get Instance() {
        if (!DebugWindowHtmlHandler.instance) {
            DebugWindowHtmlHandler.instance = new DebugWindowHtmlHandler();
        }
        return DebugWindowHtmlHandler.instance;
    }
    set Ping(ping) {
        this.pingSpan.textContent = "Ping(ms):         " + ping;
    }
    set Fps(fps) {
        this.fpsSpan.innerHTML = "<br>" + "Fps: " + fps;
    }
    set GameObjectCounter(gameObjects) {
        this.gameObjectCounterSpan.innerHTML = "<br>" + "GameObjects: " + gameObjects;
    }
    set CursorObjectSpan(cursorObject) {
        this.cursorObjectSpan.innerHTML = "<br>" + "cursorObject: " + cursorObject;
    }
    set Position(position) {
        this.positionSpan.innerHTML = "<br>" + "Position: " + position;
    }
}
exports.DebugWindowHtmlHandler = DebugWindowHtmlHandler;

},{}],17:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
class HUD extends PIXI.Container {
    constructor() {
        super();
        // this.sprites = [];
        //
        // for(let i = 0; i < 6; i++) {
        //     let sprite: PIXI.Sprite = new PIXI.Sprite(PIXI.game_utils.TextureCache["white"]);
        //     this.addChild(sprite);
        //
        //     sprite.alpha = 0.1;
        //     sprite.x = 80 + (i * 100);
        //     sprite.y = 50;
        //
        //     sprite.width = 64;
        //     sprite.height = 64;
        //     this.sprites.push(sprite);
        // }
    }
    update() {
    }
    destroy() {
        super.destroy();
    }
}
exports.HUD = HUD;

},{}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectAnimationRender_1 = require("../graphic/GameObjectAnimationRender");
class PlayerRender extends GameObjectAnimationRender_1.GameObjectAnimationRender {
    constructor() {
        super();
    }
    setObject(player) {
        super.setObject(player);
        this.playerReference = player;
        this.nameText = new PIXI.Text(this.playerReference.Name, {
            fontFamily: "Arial",
            fontSize: "12px",
            fill: "#ffffff"
        });
        this.nameText.anchor.set(0.5, 4);
        this.addChild(this.nameText);
        this.hpBar = new PIXI.Graphics;
        this.hpBar.beginFill(0xFF0000);
        this.hpBar.drawRect(-this.objectRef.Transform.ScaleX / 2, -this.objectRef.Transform.ScaleY / 2 - 13, this.objectRef.Transform.ScaleX, 7);
        this.addChild(this.hpBar);
    }
    update() {
        super.update();
        this.nameText.text = this.playerReference.Name;
        this.hpBar.scale.x = this.playerReference.HP / this.playerReference.MaxHP;
    }
    destroy() {
        super.destroy();
    }
}
exports.PlayerRender = PlayerRender;

},{"../graphic/GameObjectAnimationRender":12}],19:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsSubscriber_1 = require("../../shared/game_utils/factory/GameObjectsSubscriber");
const PlayerRender_1 = require("./PlayerRender");
const Camera_1 = require("./Camera");
const GameObjectSpriteRender_1 = require("./GameObjectSpriteRender");
const TileMap_1 = require("./TileMap");
const GameObjectPrefabs_1 = require("../../shared/game_utils/factory/GameObjectPrefabs");
const GameObjectAnimationRender_1 = require("./GameObjectAnimationRender");
const Hud_1 = require("./Hud");
const ResourcesLoader_1 = require("./ResourcesLoader");
class Renderer extends GameObjectsSubscriber_1.GameObjectsSubscriber {
    constructor(afterCreateCallback) {
        super();
        this.renderer = PIXI.autoDetectRenderer(Renderer.WIDTH, Renderer.HEIGHT, {
            view: document.getElementById("game-canvas"),
            antialias: false,
            transparent: false,
            resolution: 1,
            clearBeforeRender: false
        });
        this.rootContainer = new PIXI.Container();
        this.camera = new Camera_1.Camera(new PIXI.Point(333, 333));
        this.camera.addChild(this.rootContainer);
        this.focusedObject = null;
        this.renderObjects = new Map();
        this.resourcesLoader = ResourcesLoader_1.ResourcesLoader.Instance;
        this.resourcesLoader.registerResource('none', 'resources/images/none.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('wall', 'resources/images/wall.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('bunny', 'resources/images/bunny.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('dyzma', 'resources/images/dyzma.jpg', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('kamis', 'resources/images/kamis.jpg', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('michau', 'resources/images/michau.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('panda', 'resources/images/panda.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('bullet', 'resources/images/bullet.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('fireball', 'resources/images/fireball.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('bluebolt', 'resources/images/bluebolt.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('hp_potion', 'resources/images/hp_potion.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('portal', 'resources/images/portal.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('white', 'resources/images/white.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('doors_open', 'resources/images/doors_open.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('doors_closed', 'resources/images/doors_closed.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.registerResource('flame', 'resources/animations/flame/flame.json', ResourcesLoader_1.ResourceType.ANIMATION);
        this.resourcesLoader.registerResource('template_idle', 'resources/animations/actor_animations/template/idle.json', ResourcesLoader_1.ResourceType.OCTAGONAL_ANIMATION);
        this.resourcesLoader.registerResource('template_run', 'resources/animations/actor_animations/template/run.json', ResourcesLoader_1.ResourceType.OCTAGONAL_ANIMATION);
        this.resourcesLoader.registerResource('terrain', 'resources/maps/terrain.png', ResourcesLoader_1.ResourceType.SPRITE);
        this.resourcesLoader.load(() => {
            this.map = new TileMap_1.TileMap();
            this.rootContainer.addChild(this.map);
            afterCreateCallback();
        });
    }
    createHUD() {
        this.hud = new Hud_1.HUD();
    }
    hideNotVisibleObjects() {
        this.renderObjects.forEach((obj) => {
            obj.visible = this.isInCameraView(obj);
        });
        this.map.children.forEach((obj) => {
            obj.visible = this.isInCameraView(obj);
        });
    }
    isInCameraView(object) {
        let buffor = 100;
        let cameraX = this.camera.pivot.x - Renderer.WIDTH / 2 - buffor;
        let cameraY = this.camera.pivot.y - Renderer.HEIGHT / 2 - buffor;
        return (object.x < cameraX + Renderer.WIDTH + 2 * buffor) &&
            (object.y < cameraY + Renderer.HEIGHT + 2 * buffor) &&
            (cameraX < object.x + object.width) &&
            (cameraY < object.y + object.height);
    }
    update() {
        this.renderObjects.forEach((gameObjectRender) => {
            gameObjectRender.update();
        });
        this.map.update();
        this.hideNotVisibleObjects();
        this.camera.update();
        this.renderer.render(this.camera);
        this.renderer.render(this.hud);
    }
    onObjectCreate(gameObject) {
        if (gameObject.IsDestroyed) {
            return;
        }
        let gameObjectRender;
        let type = GameObjectPrefabs_1.Prefabs.IdToPrefabNames.get(gameObject.ID[0]);
        let resource = this.resourcesLoader.getResource(gameObject.SpriteName);
        if (type == "DefaultPlayer" || type == "Michau") {
            gameObjectRender = new PlayerRender_1.PlayerRender();
        }
        else if (resource.type == ResourcesLoader_1.ResourceType.ANIMATION || resource.type == ResourcesLoader_1.ResourceType.OCTAGONAL_ANIMATION) {
            gameObjectRender = new GameObjectAnimationRender_1.GameObjectAnimationRender();
        }
        else {
            gameObjectRender = new GameObjectSpriteRender_1.GameObjectSpriteRender();
        }
        gameObjectRender.setObject(gameObject);
        this.renderObjects.set(gameObject, gameObjectRender);
        this.rootContainer.addChild(gameObjectRender);
    }
    onObjectDestroy(gameObject) {
        if (this.renderObjects.has(gameObject)) {
            this.renderObjects.get(gameObject).destroy();
            this.renderObjects.delete(gameObject);
        }
    }
    set FocusedObject(gameObject) {
        this.camera.Follower = this.renderObjects.get(gameObject).position;
        this.map.FocusedObject = gameObject;
        this.focusedObject = gameObject;
    }
    setCurrentChunk(chunk) {
        this.map.CurrentChunk = chunk;
    }
    get CameraDeviation() {
        return this.camera.MouseDeviation;
    }
}
Renderer.WIDTH = 1024;
Renderer.HEIGHT = 576;
exports.Renderer = Renderer;

},{"../../shared/game_utils/factory/GameObjectPrefabs":92,"../../shared/game_utils/factory/GameObjectsSubscriber":94,"./Camera":11,"./GameObjectAnimationRender":12,"./GameObjectSpriteRender":14,"./Hud":17,"./PlayerRender":18,"./ResourcesLoader":20,"./TileMap":21}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ResourceType;
(function (ResourceType) {
    ResourceType[ResourceType["SPRITE"] = 0] = "SPRITE";
    ResourceType[ResourceType["ANIMATION"] = 1] = "ANIMATION";
    ResourceType[ResourceType["OCTAGONAL_ANIMATION"] = 2] = "OCTAGONAL_ANIMATION";
})(ResourceType = exports.ResourceType || (exports.ResourceType = {}));
class Resource {
    constructor(name, type) {
        this.name = name;
        this.type = type;
        this.textures = new Map();
        if (this.type == ResourceType.OCTAGONAL_ANIMATION) {
            this.textures.set("U", []);
            this.textures.set("UR", []);
            this.textures.set("R", []);
            this.textures.set("DR", []);
            this.textures.set("D", []);
            this.textures.set("DL", []);
            this.textures.set("L", []);
            this.textures.set("UL", []);
        }
        else if (type == ResourceType.ANIMATION) {
            this.textures.set(this.name, []);
        }
    }
}
exports.Resource = Resource;
class ResourcesLoader {
    constructor() {
        this.resources = new Map();
    }
    static get Instance() {
        if (ResourcesLoader.instance) {
            return ResourcesLoader.instance;
        }
        else {
            ResourcesLoader.instance = new ResourcesLoader;
            return ResourcesLoader.instance;
        }
    }
    registerResource(name, path, type) {
        PIXI.loader.add(name, path);
        this.resources.set(name, new Resource(name, type));
    }
    load(callback) {
        PIXI.loader.load(() => {
            this.postprocessResources();
            callback();
        });
    }
    getResource(name) {
        return this.resources.get(name);
    }
    postprocessResources() {
        this.resources.forEach((resource, name) => {
            for (let frame in PIXI.loader.resources[name].data.frames) {
                if (resource.type == ResourceType.OCTAGONAL_ANIMATION) {
                    let animationDirection = frame.split('_')[1];
                    resource.textures.get(animationDirection).push(PIXI.Texture.fromFrame(frame));
                }
                else if (resource.type == ResourceType.ANIMATION) {
                    resource.textures.get(resource.name).push(PIXI.Texture.fromFrame(frame));
                }
            }
        });
    }
}
exports.ResourcesLoader = ResourcesLoader;

},{}],21:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const SharedConfig_1 = require("../../shared/SharedConfig");
function compareCoords(c1, c2) {
    return c1[0] == c2[0] && c1[1] == c2[1];
}
class TileMapChunk extends PIXI.Container {
    constructor(x, y, sizeX, sizeY) {
        super();
        this.initialized = false;
        this.x = x;
        this.y = y;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
    }
    initChunkTextures() {
        let texture = new PIXI.Texture(PIXI.utils.TextureCache['terrain'], new PIXI.Rectangle(1 * 32, 5 * 32, 32, 32));
        for (let i = 0; i < this.sizeX / 32; i++) {
            for (let j = 0; j < this.sizeY / 32; j++) {
                // let texture: Texture = new PIXI.Texture(PIXI.game_utils.TextureCache['terrain'],
                //     new PIXI.Rectangle(chunk.mapGrid[i][j], chunk.mapGrid[i][j], 32, 32));
                let sprite = new PIXI.Sprite(texture);
                sprite.x = i * 32;
                sprite.y = j * 32;
                this.addChild(sprite);
            }
        }
        this.cacheAsBitmap = true;
        this.initialized = true;
    }
    get Initialized() {
        return this.initialized;
    }
}
class TileMap extends PIXI.Container {
    constructor() {
        super();
        this.numOfChunksX = SharedConfig_1.SharedConfig.numOfChunksX;
        this.numOfChunksY = SharedConfig_1.SharedConfig.numOfChunksY;
        this.focusedObject = null;
        this.visibleMapChunks = new Map();
        this.currentChunkCoords = [-1, -1];
        this.mapChunks = [];
        for (let i = 0; i < this.numOfChunksX; i++) {
            this.mapChunks[i] = [];
            for (let j = 0; j < this.numOfChunksY; j++) {
                let chunkSizeX = SharedConfig_1.SharedConfig.chunkSize;
                let chunkSizeY = SharedConfig_1.SharedConfig.chunkSize;
                let chunkX = i * chunkSizeX;
                let chunkY = j * chunkSizeY;
                if (i % 2) {
                    if (j == 0) {
                        chunkSizeY *= 1.5;
                    }
                    else if (j == this.numOfChunksY - 1) {
                        chunkY += (chunkSizeY / 2);
                        chunkSizeY *= 0.5;
                    }
                    else {
                        chunkY += (chunkSizeY / 2);
                    }
                }
                this.mapChunks[i][j] = new TileMapChunk(chunkX, chunkY, chunkSizeX, chunkSizeY);
            }
        }
    }
    updateVisibleChunks() {
        if (!this.currentChunk) {
            return;
        }
        let newChunkCoords = [this.currentChunk.x, this.currentChunk.y];
        if (compareCoords(newChunkCoords, this.currentChunkCoords)) {
            return;
        }
        this.currentChunkCoords = newChunkCoords;
        let newCoordsArr = [];
        newCoordsArr.push(newChunkCoords);
        this.currentChunk.neighbors.forEach((chunkNeighbor) => {
            newCoordsArr.push([chunkNeighbor.x, chunkNeighbor.y]);
        });
        this.visibleMapChunks.forEach((mapChunk, coords) => {
            let idx = -1;
            for (let i = 0; i < newCoordsArr.length; i++) {
                if (compareCoords(newCoordsArr[i], coords)) {
                    idx = i;
                    break;
                }
            }
            if (idx == -1) {
                this.removeChild(mapChunk);
                this.visibleMapChunks.delete(coords);
            }
            else {
                newCoordsArr.splice(idx, 1);
            }
        });
        newCoordsArr.forEach((coords) => {
            this.addToVisibleMapChunks(coords);
        });
    }
    addToVisibleMapChunks(coords) {
        let mapChunk = this.mapChunks[coords[0]][coords[1]];
        this.visibleMapChunks.set(coords, mapChunk);
        if (!mapChunk.Initialized) {
            mapChunk.initChunkTextures();
        }
        this.addChild(mapChunk);
    }
    set FocusedObject(gameObject) {
        this.focusedObject = gameObject;
        this.updateVisibleChunks();
    }
    set CurrentChunk(chunk) {
        this.currentChunk = chunk;
    }
    update() {
        this.updateVisibleChunks();
    }
    destroy() {
        for (let i = 0; i < this.numOfChunksX; i++) {
            for (let j = 0; j < this.numOfChunksY; j++) {
                this.mapChunks[i][j].destroy();
            }
        }
        super.destroy();
    }
}
exports.TileMap = TileMap;

},{"../../shared/SharedConfig":88}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("../../shared/game_utils/game/objects/GameObject");
const DebugWindowHtmlHandler_1 = require("../graphic/HtmlHandlers/DebugWindowHtmlHandler");
class Cursor extends GameObject_1.GameObject {
    constructor(transform) {
        super(transform);
        this.onObjectId = null;
        this.interactMessage = "";
        this.invisible = true;
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
    }
    destroy() {
        super.destroy();
    }
    sharedOnCollisionStay(collision) {
        let gameObject = collision.ColliderB.Parent;
        DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.CursorObjectSpan = gameObject.ID;
        this.onObjectId = gameObject.ID;
        if (gameObject.InteractPopUpMessage != null) {
            this.interactMessage = gameObject.InteractPopUpMessage;
            DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.CursorObjectSpan = gameObject.ID + " " + gameObject.InteractPopUpMessage;
        }
        else {
            this.interactMessage = null;
        }
    }
    sharedOnCollisionExit(collision) {
        let gameObject = collision.ColliderB.Parent;
        this.interactMessage = null;
        DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.CursorObjectSpan = gameObject.ID + " " + gameObject.InteractPopUpMessage;
    }
    move(x, y) {
        this.Transform.X = x;
        this.Transform.Y = y;
        this.onObjectId = null;
        this.interactMessage = null;
        this.update(0);
    }
    get OnObjectId() {
        return this.onObjectId;
    }
    get InteractMessage() {
        return this.interactMessage;
    }
}
exports.Cursor = Cursor;

},{"../../shared/game_utils/game/objects/GameObject":100,"../graphic/HtmlHandlers/DebugWindowHtmlHandler":16}],23:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/keypress.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const InputSnapshot_1 = require("../../shared/input/InputSnapshot");
const InputKeyMap_1 = require("./InputKeyMap");
const InputCommands_1 = require("../../shared/input/InputCommands");
const keypress = require("keypress.js").keypress;
class InputHandler {
    constructor(cursor) {
        this.isUp = false;
        this.isDown = false;
        this.isLeft = false;
        this.isRight = false;
        console.log(keypress);
        this.listener = new keypress.Listener();
        this.cursor = cursor;
        this.mouseButtonsDown = new Map();
        this.mouseButtonsDown.set(InputCommands_1.MouseKeys.LEFT, false);
        this.mouseButtonsDown.set(InputCommands_1.MouseKeys.MIDDLE, false);
        this.mouseButtonsDown.set(InputCommands_1.MouseKeys.RIGHT, false);
        this.clickPosition = null;
        this.snapshotCallbacks = [];
        this.inputSnapshot = new InputSnapshot_1.InputSnapshot;
        this.listener.register_combo({
            keys: InputKeyMap_1.InputKeyMap.get(InputCommands_1.INPUT_COMMAND.UP),
            on_keydown: () => {
                this.isUp = true;
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.isUp = false;
                this.invokeSnapshotCallbacks();
            }
        });
        this.listener.register_combo({
            keys: InputKeyMap_1.InputKeyMap.get(InputCommands_1.INPUT_COMMAND.DOWN),
            on_keydown: () => {
                this.isDown = true;
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.isDown = false;
                this.invokeSnapshotCallbacks();
            }
        });
        this.listener.register_combo({
            keys: InputKeyMap_1.InputKeyMap.get(InputCommands_1.INPUT_COMMAND.LEFT),
            on_keydown: () => {
                this.isLeft = true;
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.isLeft = false;
                this.invokeSnapshotCallbacks();
            }
        });
        this.listener.register_combo({
            keys: InputKeyMap_1.InputKeyMap.get(InputCommands_1.INPUT_COMMAND.RIGHT),
            on_keydown: () => {
                this.isRight = true;
                this.invokeSnapshotCallbacks();
            },
            on_keyup: () => {
                this.isRight = false;
                this.invokeSnapshotCallbacks();
            }
        });
        this.listener.register_combo({
            keys: InputKeyMap_1.InputKeyMap.get(InputCommands_1.INPUT_COMMAND.INTERACT),
            prevent_repeat: false,
            on_keydown: () => {
                this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.INTERACT, this.cursor.OnObjectId);
                this.invokeSnapshotCallbacks();
            },
        });
        this.listener.register_combo({
            keys: InputKeyMap_1.InputKeyMap.get(InputCommands_1.INPUT_COMMAND.SWITCH_WEAPON),
            on_keydown: () => {
                this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.SWITCH_WEAPON, null);
                this.invokeSnapshotCallbacks();
            },
        });
        this.listener.register_combo({
            keys: InputKeyMap_1.InputKeyMap.get(InputCommands_1.INPUT_COMMAND.TEST),
            on_keydown: () => {
                this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.TEST, this.cursor.Transform.Position);
                this.invokeSnapshotCallbacks();
            },
        });
        window.addEventListener("mousedown", this.onMouseDown.bind(this));
        window.addEventListener("mouseup", this.onMouseUp.bind(this));
        window.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            return false;
        });
    }
    addSnapshotCallback(callback) {
        this.snapshotCallbacks.push(callback);
    }
    onMouseDown(mouseEvent, isRecursion) {
        if (!isRecursion) {
            this.mouseButtonsDown.set(mouseEvent.button, true);
        }
        else if (!this.mouseButtonsDown.get(mouseEvent.button)) {
            return true;
        }
        this.clickPosition = [this.cursor.Transform.X, this.cursor.Transform.Y];
        this.mouseButton = mouseEvent.button;
        if (this.mouseButtonsDown.get(mouseEvent.button)) {
            setTimeout(() => {
                this.onMouseDown(mouseEvent, true);
            }, 100);
        }
        this.invokeSnapshotCallbacks();
        return true;
    }
    onMouseUp(mouseEvent) {
        this.mouseButtonsDown.set(mouseEvent.button, false);
        return true;
    }
    invokeSnapshotCallbacks() {
        if (this.isUp) {
            this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.HORIZONTAL, -1);
        }
        else if (this.isDown) {
            this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.HORIZONTAL, 1);
        }
        else {
            this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.HORIZONTAL, 0);
        }
        if (this.isRight) {
            this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.VERTICAL, 1);
        }
        else if (this.isLeft) {
            this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.VERTICAL, -1);
        }
        else {
            this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.VERTICAL, 0);
        }
        if (this.clickPosition != null) {
            if (this.mouseButton == InputCommands_1.MouseKeys.LEFT) {
                this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.LEFT_MOUSE, this.clickPosition.toString());
            }
            else if (this.mouseButton == InputCommands_1.MouseKeys.RIGHT) {
                this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.RIGHT_MOUSE, this.clickPosition.toString());
            }
            else {
                this.inputSnapshot.append(InputCommands_1.INPUT_COMMAND.MIDDLE_MOUSE, this.clickPosition.toString());
            }
            this.clickPosition = null;
        }
        this.inputSnapshot.resetTime();
        this.snapshotCallbacks.forEach((callback) => {
            callback(this.inputSnapshot);
        });
        this.inputSnapshot = new InputSnapshot_1.InputSnapshot;
    }
}
exports.InputHandler = InputHandler;

},{"../../shared/input/InputCommands":113,"../../shared/input/InputSnapshot":114,"./InputKeyMap":24,"keypress.js":63}],24:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const InputCommands_1 = require("../../shared/input/InputCommands");
exports.InputKeyMap = new Map([
    [InputCommands_1.INPUT_COMMAND.UP, 'w'],
    [InputCommands_1.INPUT_COMMAND.DOWN, 's'],
    [InputCommands_1.INPUT_COMMAND.LEFT, 'a'],
    [InputCommands_1.INPUT_COMMAND.RIGHT, 'd'],
    [InputCommands_1.INPUT_COMMAND.INTERACT, 'e'],
    [InputCommands_1.INPUT_COMMAND.SWITCH_WEAPON, 'q'],
    [InputCommands_1.INPUT_COMMAND.TEST, 'f'],
]);

},{"../../shared/input/InputCommands":113}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SharedConfig_1 = require("../shared/SharedConfig");
const GameClient_1 = require("./GameClient");
SharedConfig_1.SharedConfig.ORIGIN = SharedConfig_1.Origin.CLIENT;
window.onload = () => {
    new GameClient_1.GameClient();
};

},{"../shared/SharedConfig":88,"./GameClient":9}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketMsgs_1 = require("../../shared/net/SocketMsgs");
const DebugWindowHtmlHandler_1 = require("../graphic/HtmlHandlers/DebugWindowHtmlHandler");
class HeartBeatSender {
    constructor(socket, rate) {
        this.hbId = 0;
        this.interval = 1000;
        this.isRunning = false;
        this.socket = socket;
        this.socket.on(SocketMsgs_1.SocketMsgs.HEARTBEAT_RESPONSE, this.heartBeatResponse.bind(this));
        this.heartBeats = new Map();
        if (rate != null) {
            this.interval = rate;
        }
    }
    heartBeatResponse(id) {
        if (this.heartBeats.has(id)) {
            let ping = new Date().getTime() - this.heartBeats.get(id);
            DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.Ping = ping.toString();
            if (this.isRunning) {
                setTimeout(() => this.sendHeartBeat(), this.interval);
            }
            this.heartBeats.delete(id);
        }
    }
    sendHeartBeat() {
        this.isRunning = true;
        this.socket.emit(SocketMsgs_1.SocketMsgs.HEARTBEAT, this.hbId);
        this.heartBeats.set(this.hbId, new Date().getTime());
        this.hbId++;
    }
    stopSendingHeartbeats() {
        this.isRunning = false;
    }
}
exports.HeartBeatSender = HeartBeatSender;

},{"../../shared/net/SocketMsgs":115,"../graphic/HtmlHandlers/DebugWindowHtmlHandler":16}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketMsgs_1 = require("../../shared/net/SocketMsgs");
class InputSender {
    constructor(socket) {
        this.socket = socket;
    }
    sendInput(snapshot) {
        let serializedSnapshot = snapshot.serializeSnapshot();
        //console.log(serializedSnapshot);
        if (serializedSnapshot.length > 0) {
            this.socket.emit(SocketMsgs_1.SocketMsgs.INPUT_SNAPSHOT, serializedSnapshot);
        }
    }
}
exports.InputSender = InputSender;

},{"../../shared/net/SocketMsgs":115}],28:[function(require,module,exports){
module.exports = after

function after(count, callback, err_cb) {
    var bail = false
    err_cb = err_cb || noop
    proxy.count = count

    return (count === 0) ? callback() : proxy

    function proxy(err, result) {
        if (proxy.count <= 0) {
            throw new Error('after called too many times')
        }
        --proxy.count

        // after first error, rest are passed to err_cb
        if (err) {
            bail = true
            callback(err)
            // future error callbacks will go to error handler
            callback = err_cb
        } else if (proxy.count === 0 && !bail) {
            callback(null, result)
        }
    }
}

function noop() {}

},{}],29:[function(require,module,exports){
/**
 * An abstraction for slicing an arraybuffer even when
 * ArrayBuffer.prototype.slice is not supported
 *
 * @api public
 */

module.exports = function(arraybuffer, start, end) {
  var bytes = arraybuffer.byteLength;
  start = start || 0;
  end = end || bytes;

  if (arraybuffer.slice) { return arraybuffer.slice(start, end); }

  if (start < 0) { start += bytes; }
  if (end < 0) { end += bytes; }
  if (end > bytes) { end = bytes; }

  if (start >= bytes || start >= end || bytes === 0) {
    return new ArrayBuffer(0);
  }

  var abv = new Uint8Array(arraybuffer);
  var result = new Uint8Array(end - start);
  for (var i = start, ii = 0; i < end; i++, ii++) {
    result[ii] = abv[i];
  }
  return result.buffer;
};

},{}],30:[function(require,module,exports){

/**
 * Expose `Backoff`.
 */

module.exports = Backoff;

/**
 * Initialize backoff timer with `opts`.
 *
 * - `min` initial timeout in milliseconds [100]
 * - `max` max timeout [10000]
 * - `jitter` [0]
 * - `factor` [2]
 *
 * @param {Object} opts
 * @api public
 */

function Backoff(opts) {
  opts = opts || {};
  this.ms = opts.min || 100;
  this.max = opts.max || 10000;
  this.factor = opts.factor || 2;
  this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
  this.attempts = 0;
}

/**
 * Return the backoff duration.
 *
 * @return {Number}
 * @api public
 */

Backoff.prototype.duration = function(){
  var ms = this.ms * Math.pow(this.factor, this.attempts++);
  if (this.jitter) {
    var rand =  Math.random();
    var deviation = Math.floor(rand * this.jitter * ms);
    ms = (Math.floor(rand * 10) & 1) == 0  ? ms - deviation : ms + deviation;
  }
  return Math.min(ms, this.max) | 0;
};

/**
 * Reset the number of attempts.
 *
 * @api public
 */

Backoff.prototype.reset = function(){
  this.attempts = 0;
};

/**
 * Set the minimum duration
 *
 * @api public
 */

Backoff.prototype.setMin = function(min){
  this.ms = min;
};

/**
 * Set the maximum duration
 *
 * @api public
 */

Backoff.prototype.setMax = function(max){
  this.max = max;
};

/**
 * Set the jitter
 *
 * @api public
 */

Backoff.prototype.setJitter = function(jitter){
  this.jitter = jitter;
};


},{}],31:[function(require,module,exports){
/*
 * base64-arraybuffer
 * https://github.com/niklasvh/base64-arraybuffer
 *
 * Copyright (c) 2012 Niklas von Hertzen
 * Licensed under the MIT license.
 */
(function(){
  "use strict";

  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // Use a lookup table to find the index.
  var lookup = new Uint8Array(256);
  for (var i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  exports.encode = function(arraybuffer) {
    var bytes = new Uint8Array(arraybuffer),
    i, len = bytes.length, base64 = "";

    for (i = 0; i < len; i+=3) {
      base64 += chars[bytes[i] >> 2];
      base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
      base64 += chars[bytes[i + 2] & 63];
    }

    if ((len % 3) === 2) {
      base64 = base64.substring(0, base64.length - 1) + "=";
    } else if (len % 3 === 1) {
      base64 = base64.substring(0, base64.length - 2) + "==";
    }

    return base64;
  };

  exports.decode =  function(base64) {
    var bufferLength = base64.length * 0.75,
    len = base64.length, i, p = 0,
    encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }

    var arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);

    for (i = 0; i < len; i+=4) {
      encoded1 = lookup[base64.charCodeAt(i)];
      encoded2 = lookup[base64.charCodeAt(i+1)];
      encoded3 = lookup[base64.charCodeAt(i+2)];
      encoded4 = lookup[base64.charCodeAt(i+3)];

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arraybuffer;
  };
})();

},{}],32:[function(require,module,exports){
(function (global){
/**
 * Create a blob builder even when vendor prefixes exist
 */

var BlobBuilder = global.BlobBuilder
  || global.WebKitBlobBuilder
  || global.MSBlobBuilder
  || global.MozBlobBuilder;

/**
 * Check if Blob constructor is supported
 */

var blobSupported = (function() {
  try {
    var a = new Blob(['hi']);
    return a.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if Blob constructor supports ArrayBufferViews
 * Fails in Safari 6, so we need to map to ArrayBuffers there.
 */

var blobSupportsArrayBufferView = blobSupported && (function() {
  try {
    var b = new Blob([new Uint8Array([1,2])]);
    return b.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if BlobBuilder is supported
 */

var blobBuilderSupported = BlobBuilder
  && BlobBuilder.prototype.append
  && BlobBuilder.prototype.getBlob;

/**
 * Helper function that maps ArrayBufferViews to ArrayBuffers
 * Used by BlobBuilder constructor and old browsers that didn't
 * support it in the Blob constructor.
 */

function mapArrayBufferViews(ary) {
  for (var i = 0; i < ary.length; i++) {
    var chunk = ary[i];
    if (chunk.buffer instanceof ArrayBuffer) {
      var buf = chunk.buffer;

      // if this is a subarray, make a copy so we only
      // include the subarray region from the underlying buffer
      if (chunk.byteLength !== buf.byteLength) {
        var copy = new Uint8Array(chunk.byteLength);
        copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
        buf = copy.buffer;
      }

      ary[i] = buf;
    }
  }
}

function BlobBuilderConstructor(ary, options) {
  options = options || {};

  var bb = new BlobBuilder();
  mapArrayBufferViews(ary);

  for (var i = 0; i < ary.length; i++) {
    bb.append(ary[i]);
  }

  return (options.type) ? bb.getBlob(options.type) : bb.getBlob();
};

function BlobConstructor(ary, options) {
  mapArrayBufferViews(ary);
  return new Blob(ary, options || {});
};

module.exports = (function() {
  if (blobSupported) {
    return blobSupportsArrayBufferView ? global.Blob : BlobConstructor;
  } else if (blobBuilderSupported) {
    return BlobBuilderConstructor;
  } else {
    return undefined;
  }
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],33:[function(require,module,exports){
/**
 * Slice reference.
 */

var slice = [].slice;

/**
 * Bind `obj` to `fn`.
 *
 * @param {Object} obj
 * @param {Function|String} fn or string
 * @return {Function}
 * @api public
 */

module.exports = function(obj, fn){
  if ('string' == typeof fn) fn = obj[fn];
  if ('function' != typeof fn) throw new Error('bind() requires a function');
  var args = slice.call(arguments, 2);
  return function(){
    return fn.apply(obj, args.concat(slice.call(arguments)));
  }
};

},{}],34:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

if (typeof module !== 'undefined') {
  module.exports = Emitter;
}

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  function on() {
    this.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks['$' + event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks['$' + event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks['$' + event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks['$' + event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],35:[function(require,module,exports){

module.exports = function(a, b){
  var fn = function(){};
  fn.prototype = b.prototype;
  a.prototype = new fn;
  a.prototype.constructor = a;
};
},{}],36:[function(require,module,exports){
const BVH = require('./modules/BVH.js')
const Circle = require('./modules/Circle.js')
const Polygon = require('./modules/Polygon.js')
const Point = require('./modules/Point.js')
const Result = require('./modules/Result.js')
const SAT = require('./modules/SAT.js')

/**
 * A collision system used to track bodies in order to improve collision detection performance
 * @class
 */
class Collisions {
  /**
   * @constructor
   */
  constructor () {
    /** @private */
    this._bvh = new BVH()
  }

  /**
   * Creates a {@link Circle} and inserts it into the collision system
   * @param {Number} [x = 0] The starting X coordinate
   * @param {Number} [y = 0] The starting Y coordinate
   * @param {Number} [radius = 0] The radius
   * @param {Number} [scale = 1] The scale
   * @param {Number} [padding = 0] The amount to pad the bounding volume when testing for potential collisions
   * @returns {Circle}
   */
  createCircle (x = 0, y = 0, radius = 0, scale = 1, padding = 0) {
    const body = new Circle(x, y, radius, scale, padding)

    this._bvh.insert(body)

    return body
  }

  /**
   * Creates a {@link Polygon} and inserts it into the collision system
   * @param {Number} [x = 0] The starting X coordinate
   * @param {Number} [y = 0] The starting Y coordinate
   * @param {Array<Number[]>} [points = []] An array of coordinate pairs making up the polygon - [[x1, y1], [x2, y2], ...]
   * @param {Number} [angle = 0] The starting rotation in radians
   * @param {Number} [scale_x = 1] The starting scale along the X axis
   * @param {Number} [scale_y = 1] The starting scale long the Y axis
   * @param {Number} [padding = 0] The amount to pad the bounding volume when testing for potential collisions
   * @returns {Polygon}
   */
  createPolygon (x = 0, y = 0, points = [[0, 0]], angle = 0, scale_x = 1, scale_y = 1, padding = 0) {
    const body = new Polygon(x, y, points, angle, scale_x, scale_y, padding)

    this._bvh.insert(body)

    return body
  }

  /**
   * Creates a {@link Point} and inserts it into the collision system
   * @param {Number} [x = 0] The starting X coordinate
   * @param {Number} [y = 0] The starting Y coordinate
   * @param {Number} [padding = 0] The amount to pad the bounding volume when testing for potential collisions
   * @returns {Point}
   */
  createPoint (x = 0, y = 0, padding = 0) {
    const body = new Point(x, y, padding)

    this._bvh.insert(body)

    return body
  }

  /**
   * Creates a {@link Result} used to collect the detailed results of a collision test
   */
  createResult () {
    return new Result()
  }

  /**
   * Creates a Result used to collect the detailed results of a collision test
   */
  static createResult () {
    return new Result()
  }

  /**
   * Inserts bodies into the collision system
   * @param {...Circle|...Polygon|...Point} bodies
   */
  insert (...bodies) {
    for (const body of bodies) {
      this._bvh.insert(body, false)
    }

    return this
  }

  /**
   * Removes bodies = require(the collision system
   * @param {...Circle|...Polygon|...Point} bodies
   */
  remove (...bodies) {
    for (const body of bodies) {
      this._bvh.remove(body, false)
    }

    return this
  }

  /**
   * Updates the collision system. This should be called before any collisions are tested.
   */
  update () {
    this._bvh.update()

    return this
  }

  /**
   * Draws the bodies within the system to a CanvasRenderingContext2D's current path
   * @param {CanvasRenderingContext2D} context The context to draw to
   */
  draw (context) {
    return this._bvh.draw(context)
  }

  /**
   * Draws the system's BVH to a CanvasRenderingContext2D's current path. This is useful for testing out different padding values for bodies.
   * @param {CanvasRenderingContext2D} context The context to draw to
   */
  drawBVH (context) {
    return this._bvh.drawBVH(context)
  }

  /**
   * Returns a list of potential collisions for a body
   * @param {Circle|Polygon|Point} body The body to test for potential collisions against
   * @returns {Array<Body>}
   */
  potentials (body) {
    return this._bvh.potentials(body)
  }

  /**
   * Determines if two bodies are colliding
   * @param {Circle|Polygon|Point} target The target body to test against
   * @param {Result} [result = null] A Result object on which to store information about the collision
   * @param {Boolean} [aabb = true] Set to false to skip the AABB test (useful if you use your own potential collision heuristic)
   * @returns {Boolean}
   */
  collides (source, target, result = null, aabb = true) {
    return SAT(source, target, result, aabb)
  }
};

module.exports = {
  default: Collisions,
  Collisions,
  Result,
  Circle,
  Polygon,
  Point
}

},{"./modules/BVH.js":37,"./modules/Circle.js":40,"./modules/Point.js":41,"./modules/Polygon.js":42,"./modules/Result.js":43,"./modules/SAT.js":44}],37:[function(require,module,exports){
const BVHBranch = require('./BVHBranch')

/**
 * A Bounding Volume Hierarchy (BVH) used to find potential collisions quickly
 * @class
 * @private
 */
class BVH {
  /**
   * @constructor
   */
  constructor () {
    /** @private */
    this._hierarchy = null

    /** @private */
    this._bodies = []

    /** @private */
    this._dirty_branches = []
  }

  /**
   * Inserts a body into the BVH
   * @param {Circle|Polygon|Point} body The body to insert
   * @param {Boolean} [updating = false] Set to true if the body already exists in the BVH (used internally when updating the body's position)
   */
  insert (body, updating = false) {
    if (!updating) {
      const bvh = body._bvh

      if (bvh && bvh !== this) {
        throw new Error('Body belongs to another collision system')
      }

      body._bvh = this
      this._bodies.push(body)
    }

    const polygon = body._polygon
    const body_x = body.x
    const body_y = body.y

    if (polygon) {
      if (
        body._dirty_coords ||
        body.x !== body._x ||
        body.y !== body._y ||
        body.angle !== body._angle ||
        body.scale_x !== body._scale_x ||
        body.scale_y !== body._scale_y
      ) {
        body._calculateCoords()
      }
    }

    const padding = body._bvh_padding
    const radius = polygon ? 0 : body.radius * body.scale
    const body_min_x = (polygon ? body._min_x : body_x - radius) - padding
    const body_min_y = (polygon ? body._min_y : body_y - radius) - padding
    const body_max_x = (polygon ? body._max_x : body_x + radius) + padding
    const body_max_y = (polygon ? body._max_y : body_y + radius) + padding

    body._bvh_min_x = body_min_x
    body._bvh_min_y = body_min_y
    body._bvh_max_x = body_max_x
    body._bvh_max_y = body_max_y

    let current = this._hierarchy
    let sort = 0

    if (!current) {
      this._hierarchy = body
    } else {
      while (true) {
        // Branch
        if (current._bvh_branch) {
          const left = current._bvh_left
          const left_min_y = left._bvh_min_y
          const left_max_x = left._bvh_max_x
          const left_max_y = left._bvh_max_y
          const left_new_min_x = body_min_x < left._bvh_min_x ? body_min_x : left._bvh_min_x
          const left_new_min_y = body_min_y < left_min_y ? body_min_y : left_min_y
          const left_new_max_x = body_max_x > left_max_x ? body_max_x : left_max_x
          const left_new_max_y = body_max_y > left_max_y ? body_max_y : left_max_y
          const left_volume = (left_max_x - left._bvh_min_x) * (left_max_y - left_min_y)
          const left_new_volume = (left_new_max_x - left_new_min_x) * (left_new_max_y - left_new_min_y)
          const left_difference = left_new_volume - left_volume

          const right = current._bvh_right
          const right_min_x = right._bvh_min_x
          const right_min_y = right._bvh_min_y
          const right_max_x = right._bvh_max_x
          const right_max_y = right._bvh_max_y
          const right_new_min_x = body_min_x < right_min_x ? body_min_x : right_min_x
          const right_new_min_y = body_min_y < right_min_y ? body_min_y : right_min_y
          const right_new_max_x = body_max_x > right_max_x ? body_max_x : right_max_x
          const right_new_max_y = body_max_y > right_max_y ? body_max_y : right_max_y
          const right_volume = (right_max_x - right_min_x) * (right_max_y - right_min_y)
          const right_new_volume = (right_new_max_x - right_new_min_x) * (right_new_max_y - right_new_min_y)
          const right_difference = right_new_volume - right_volume

          current._bvh_sort = sort++
          current._bvh_min_x = left_new_min_x < right_new_min_x ? left_new_min_x : right_new_min_x
          current._bvh_min_y = left_new_min_y < right_new_min_y ? left_new_min_y : right_new_min_y
          current._bvh_max_x = left_new_max_x > right_new_max_x ? left_new_max_x : right_new_max_x
          current._bvh_max_y = left_new_max_y > right_new_max_y ? left_new_max_y : right_new_max_y

          current = left_difference <= right_difference ? left : right
        } else {
        // Leaf
          const grandparent = current._bvh_parent
          const parent_min_x = current._bvh_min_x
          const parent_min_y = current._bvh_min_y
          const parent_max_x = current._bvh_max_x
          const parent_max_y = current._bvh_max_y
          const new_parent = current._bvh_parent = body._bvh_parent = BVHBranch.getBranch()

          new_parent._bvh_parent = grandparent
          new_parent._bvh_left = current
          new_parent._bvh_right = body
          new_parent._bvh_sort = sort++
          new_parent._bvh_min_x = body_min_x < parent_min_x ? body_min_x : parent_min_x
          new_parent._bvh_min_y = body_min_y < parent_min_y ? body_min_y : parent_min_y
          new_parent._bvh_max_x = body_max_x > parent_max_x ? body_max_x : parent_max_x
          new_parent._bvh_max_y = body_max_y > parent_max_y ? body_max_y : parent_max_y

          if (!grandparent) {
            this._hierarchy = new_parent
          } else if (grandparent._bvh_left === current) {
            grandparent._bvh_left = new_parent
          } else {
            grandparent._bvh_right = new_parent
          }

          break
        }
      }
    }
  }

  /**
   * Removes a body from the BVH
   * @param {Circle|Polygon|Point} body The body to remove
   * @param {Boolean} [updating = false] Set to true if this is a temporary removal (used internally when updating the body's position)
   */
  remove (body, updating = false) {
    if (!updating) {
      const bvh = body._bvh

      if (bvh && bvh !== this) {
        throw new Error('Body belongs to another collision system')
      }

      body._bvh = null
      this._bodies.splice(this._bodies.indexOf(body), 1)
    }

    if (this._hierarchy === body) {
      this._hierarchy = null

      return
    }

    const parent = body._bvh_parent
    const grandparent = parent._bvh_parent
    const parent_left = parent._bvh_left
    const sibling = parent_left === body ? parent._bvh_right : parent_left

    sibling._bvh_parent = grandparent

    if (sibling._bvh_branch) {
      sibling._bvh_sort = parent._bvh_sort
    }

    if (grandparent) {
      if (grandparent._bvh_left === parent) {
        grandparent._bvh_left = sibling
      } else {
        grandparent._bvh_right = sibling
      }

      let branch = grandparent

      while (branch) {
        const left = branch._bvh_left
        const left_min_x = left._bvh_min_x
        const left_min_y = left._bvh_min_y
        const left_max_x = left._bvh_max_x
        const left_max_y = left._bvh_max_y

        const right = branch._bvh_right
        const right_min_x = right._bvh_min_x
        const right_min_y = right._bvh_min_y
        const right_max_x = right._bvh_max_x
        const right_max_y = right._bvh_max_y

        branch._bvh_min_x = left_min_x < right_min_x ? left_min_x : right_min_x
        branch._bvh_min_y = left_min_y < right_min_y ? left_min_y : right_min_y
        branch._bvh_max_x = left_max_x > right_max_x ? left_max_x : right_max_x
        branch._bvh_max_y = left_max_y > right_max_y ? left_max_y : right_max_y

        branch = branch._bvh_parent
      }
    } else {
      this._hierarchy = sibling
    }

    BVHBranch.releaseBranch(parent)
  }

  /**
   * Updates the BVH. Moved bodies are removed/inserted.
   */
  update () {
    const bodies = this._bodies
    const count = bodies.length

    for (let i = 0; i < count; ++i) {
      const body = bodies[i]

      let update = false

      if (!update && body.padding !== body._bvh_padding) {
        body._bvh_padding = body.padding
        update = true
      }

      if (!update) {
        const polygon = body._polygon

        if (polygon) {
          if (
            body._dirty_coords ||
            body.x !== body._x ||
            body.y !== body._y ||
            body.angle !== body._angle ||
            body.scale_x !== body._scale_x ||
            body.scale_y !== body._scale_y
          ) {
            body._calculateCoords()
          }
        }

        const x = body.x
        const y = body.y
        const radius = polygon ? 0 : body.radius * body.scale
        const min_x = polygon ? body._min_x : x - radius
        const min_y = polygon ? body._min_y : y - radius
        const max_x = polygon ? body._max_x : x + radius
        const max_y = polygon ? body._max_y : y + radius

        update = min_x < body._bvh_min_x || min_y < body._bvh_min_y || max_x > body._bvh_max_x || max_y > body._bvh_max_y
      }

      if (update) {
        this.remove(body, true)
        this.insert(body, true)
      }
    }
  }

  /**
   * Returns a list of potential collisions for a body
   * @param {Circle|Polygon|Point} body The body to test
   * @returns {Array<Body>}
   */
  potentials (body) {
    const results = []
    const min_x = body._bvh_min_x
    const min_y = body._bvh_min_y
    const max_x = body._bvh_max_x
    const max_y = body._bvh_max_y

    let current = this._hierarchy
    let traverse_left = true

    if (!current || !current._bvh_branch) {
      return results
    }

    while (current) {
      if (traverse_left) {
        traverse_left = false

        let left = current._bvh_branch ? current._bvh_left : null

        while (
          left &&
          left._bvh_max_x >= min_x &&
          left._bvh_max_y >= min_y &&
          left._bvh_min_x <= max_x &&
          left._bvh_min_y <= max_y
        ) {
          current = left
          left = current._bvh_branch ? current._bvh_left : null
        }
      }

      const branch = current._bvh_branch
      const right = branch ? current._bvh_right : null

      if (
        right &&
        right._bvh_max_x > min_x &&
        right._bvh_max_y > min_y &&
        right._bvh_min_x < max_x &&
        right._bvh_min_y < max_y
      ) {
        current = right
        traverse_left = true
      } else {
        if (!branch && current !== body) {
          results.push(current)
        }

        let parent = current._bvh_parent

        if (parent) {
          while (parent && parent._bvh_right === current) {
            current = parent
            parent = current._bvh_parent
          }

          current = parent
        } else {
          break
        }
      }
    }

    return results
  }

  /**
   * Draws the bodies within the BVH to a CanvasRenderingContext2D's current path
   * @param {CanvasRenderingContext2D} context The context to draw to
   */
  draw (context) {
    const bodies = this._bodies
    const count = bodies.length

    for (let i = 0; i < count; ++i) {
      bodies[i].draw(context)
    }
  }

  /**
   * Draws the BVH to a CanvasRenderingContext2D's current path. This is useful for testing out different padding values for bodies.
   * @param {CanvasRenderingContext2D} context The context to draw to
   */
  drawBVH (context) {
    let current = this._hierarchy
    let traverse_left = true

    while (current) {
      if (traverse_left) {
        traverse_left = false

        let left = current._bvh_branch ? current._bvh_left : null

        while (left) {
          current = left
          left = current._bvh_branch ? current._bvh_left : null
        }
      }

      const branch = current._bvh_branch
      const min_x = current._bvh_min_x
      const min_y = current._bvh_min_y
      const max_x = current._bvh_max_x
      const max_y = current._bvh_max_y
      const right = branch ? current._bvh_right : null

      context.moveTo(min_x, min_y)
      context.lineTo(max_x, min_y)
      context.lineTo(max_x, max_y)
      context.lineTo(min_x, max_y)
      context.lineTo(min_x, min_y)

      if (right) {
        current = right
        traverse_left = true
      } else {
        let parent = current._bvh_parent

        if (parent) {
          while (parent && parent._bvh_right === current) {
            current = parent
            parent = current._bvh_parent
          }

          current = parent
        } else {
          break
        }
      }
    }
  }
};

module.exports = BVH

module.exports.default = module.exports

},{"./BVHBranch":38}],38:[function(require,module,exports){
/**
 * @private
 */
const branch_pool = []

/**
 * A branch within a BVH
 * @class
 * @private
 */
class BVHBranch {
  /**
   * @constructor
   */
  constructor () {
    /** @private */
    this._bvh_parent = null

    /** @private */
    this._bvh_branch = true

    /** @private */
    this._bvh_left = null

    /** @private */
    this._bvh_right = null

    /** @private */
    this._bvh_sort = 0

    /** @private */
    this._bvh_min_x = 0

    /** @private */
    this._bvh_min_y = 0

    /** @private */
    this._bvh_max_x = 0

    /** @private */
    this._bvh_max_y = 0
  }

  /**
   * Returns a branch from the branch pool or creates a new branch
   * @returns {BVHBranch}
   */
  static getBranch () {
    if (branch_pool.length) {
      return branch_pool.pop()
    }

    return new BVHBranch()
  }

  /**
   * Releases a branch back into the branch pool
   * @param {BVHBranch} branch The branch to release
   */
  static releaseBranch (branch) {
    branch_pool.push(branch)
  }

  /**
   * Sorting callback used to sort branches by deepest first
   * @param {BVHBranch} a The first branch
   * @param {BVHBranch} b The second branch
   * @returns {Number}
   */
  static sortBranches (a, b) {
    return a.sort > b.sort ? -1 : 1
  }
};

module.exports = BVHBranch

module.exports.default = module.exports

},{}],39:[function(require,module,exports){
const Result = require('./Result')
const SAT = require('./SAT')

/**
 * The base class for bodies used to detect collisions
 * @class
 * @protected
 */
class Body {
  /**
   * @constructor
   * @param {Number} [x = 0] The starting X coordinate
   * @param {Number} [y = 0] The starting Y coordinate
   * @param {Number} [padding = 0] The amount to pad the bounding volume when testing for potential collisions
   */
  constructor (x = 0, y = 0, padding = 0) {
    /**
     * @desc The X coordinate of the body
     * @type {Number}
     */
    this.x = x

    /**
     * @desc The Y coordinate of the body
     * @type {Number}
     */
    this.y = y

    /**
     * @desc The amount to pad the bounding volume when testing for potential collisions
     * @type {Number}
     */
    this.padding = padding

    /** @private */
    this._circle = false

    /** @private */
    this._polygon = false

    /** @private */
    this._point = false

    /** @private */
    this._bvh = null

    /** @private */
    this._bvh_parent = null

    /** @private */
    this._bvh_branch = false

    /** @private */
    this._bvh_padding = padding

    /** @private */
    this._bvh_min_x = 0

    /** @private */
    this._bvh_min_y = 0

    /** @private */
    this._bvh_max_x = 0

    /** @private */
    this._bvh_max_y = 0
  }

  /**
   * Determines if the body is colliding with another body
   * @param {Circle|Polygon|Point} target The target body to test against
   * @param {Result} [result = null] A Result object on which to store information about the collision
   * @param {Boolean} [aabb = true] Set to false to skip the AABB test (useful if you use your own potential collision heuristic)
   * @returns {Boolean}
   */
  collides (target, result = null, aabb = true) {
    return SAT(this, target, result, aabb)
  }

  /**
   * Returns a list of potential collisions
   * @returns {Array<Body>}
   */
  potentials () {
    const bvh = this._bvh

    if (bvh === null) {
      throw new Error('Body does not belong to a collision system')
    }

    return bvh.potentials(this)
  }

  /**
   * Removes the body from its current collision system
   */
  remove () {
    const bvh = this._bvh

    if (bvh) {
      bvh.remove(this, false)
    }
  }

  /**
   * Creates a {@link Result} used to collect the detailed results of a collision test
   */
  createResult () {
    return new Result()
  }

  /**
   * Creates a Result used to collect the detailed results of a collision test
   */
  static createResult () {
    return new Result()
  }
};

module.exports = Body

module.exports.default = module.exports

},{"./Result":43,"./SAT":44}],40:[function(require,module,exports){
const Body = require('./Body')

/**
 * A circle used to detect collisions
 * @class
 */
class Circle extends Body {
  /**
   * @constructor
   * @param {Number} [x = 0] The starting X coordinate
   * @param {Number} [y = 0] The starting Y coordinate
   * @param {Number} [radius = 0] The radius
   * @param {Number} [scale = 1] The scale
   * @param {Number} [padding = 0] The amount to pad the bounding volume when testing for potential collisions
   */
  constructor (x = 0, y = 0, radius = 0, scale = 1, padding = 0) {
    super(x, y, padding)

    /**
     * @desc
     * @type {Number}
     */
    this.radius = radius

    /**
     * @desc
     * @type {Number}
     */
    this.scale = scale
  }

  /**
   * Draws the circle to a CanvasRenderingContext2D's current path
   * @param {CanvasRenderingContext2D} context The context to add the arc to
   */
  draw (context) {
    const x = this.x
    const y = this.y
    const radius = this.radius * this.scale

    context.moveTo(x + radius, y)
    context.arc(x, y, radius, 0, Math.PI * 2)
  }
};

module.exports = Circle

module.exports.default = module.exports

},{"./Body":39}],41:[function(require,module,exports){
const Polygon = require('./Polygon')

/**
 * A point used to detect collisions
 * @class
 */
class Point extends Polygon {
  /**
   * @constructor
   * @param {Number} [x = 0] The starting X coordinate
   * @param {Number} [y = 0] The starting Y coordinate
   * @param {Number} [padding = 0] The amount to pad the bounding volume when testing for potential collisions
   */
  constructor (x = 0, y = 0, padding = 0) {
    super(x, y, [[0, 0]], 0, 1, 1, padding)

    /** @private */
    this._point = true
  }
};

Point.prototype.setPoints = undefined

module.exports = Point

module.exports.default = module.exports

},{"./Polygon":42}],42:[function(require,module,exports){
const Body = require('./Body')

/**
 * A polygon used to detect collisions
 * @class
 */
class Polygon extends Body {
  /**
   * @constructor
   * @param {Number} [x = 0] The starting X coordinate
   * @param {Number} [y = 0] The starting Y coordinate
   * @param {Array<Number[]>} [points = []] An array of coordinate pairs making up the polygon - [[x1, y1], [x2, y2], ...]
   * @param {Number} [angle = 0] The starting rotation in radians
   * @param {Number} [scale_x = 1] The starting scale along the X axis
   * @param {Number} [scale_y = 1] The starting scale long the Y axis
   * @param {Number} [padding = 0] The amount to pad the bounding volume when testing for potential collisions
   */
  constructor (x = 0, y = 0, points = [], angle = 0, scale_x = 1, scale_y = 1, padding = 0) {
    super(x, y, padding)

    /**
     * @desc The angle of the body in radians
     * @type {Number}
     */
    this.angle = angle

    /**
     * @desc The scale of the body along the X axis
     * @type {Number}
     */
    this.scale_x = scale_x

    /**
     * @desc The scale of the body along the Y axis
     * @type {Number}
     */
    this.scale_y = scale_y

    /** @private */
    this._polygon = true

    /** @private */
    this._x = x

    /** @private */
    this._y = y

    /** @private */
    this._angle = angle

    /** @private */
    this._scale_x = scale_x

    /** @private */
    this._scale_y = scale_y

    /** @private */
    this._min_x = 0

    /** @private */
    this._min_y = 0

    /** @private */
    this._max_x = 0

    /** @private */
    this._max_y = 0

    /** @private */
    this._points = null

    /** @private */
    this._coords = null

    /** @private */
    this._edges = null

    /** @private */
    this._normals = null

    /** @private */
    this._dirty_coords = true

    /** @private */
    this._dirty_normals = true

    Polygon.prototype.setPoints.call(this, points)
  }

  /**
   * Draws the polygon to a CanvasRenderingContext2D's current path
   * @param {CanvasRenderingContext2D} context The context to add the shape to
   */
  draw (context) {
    if (
      this._dirty_coords ||
      this.x !== this._x ||
      this.y !== this._y ||
      this.angle !== this._angle ||
      this.scale_x !== this._scale_x ||
      this.scale_y !== this._scale_y
    ) {
      this._calculateCoords()
    }

    const coords = this._coords

    if (coords.length === 2) {
      context.moveTo(coords[0], coords[1])
      context.arc(coords[0], coords[1], 1, 0, Math.PI * 2)
    } else {
      context.moveTo(coords[0], coords[1])

      for (let i = 2; i < coords.length; i += 2) {
        context.lineTo(coords[i], coords[i + 1])
      }

      if (coords.length > 4) {
        context.lineTo(coords[0], coords[1])
      }
    }
  }

  /**
   * Sets the points making up the polygon. It's important to use this function when changing the polygon's shape to ensure internal data is also updated.
   * @param {Array<Number[]>} new_points An array of coordinate pairs making up the polygon - [[x1, y1], [x2, y2], ...]
   */
  setPoints (new_points) {
    const count = new_points.length

    this._points = new Float64Array(count * 2)
    this._coords = new Float64Array(count * 2)
    this._edges = new Float64Array(count * 2)
    this._normals = new Float64Array(count * 2)

    const points = this._points

    for (let i = 0, ix = 0, iy = 1; i < count; ++i, ix += 2, iy += 2) {
      const new_point = new_points[i]

      points[ix] = new_point[0]
      points[iy] = new_point[1]
    }

    this._dirty_coords = true
  }

  /**
   * Calculates and caches the polygon's world coordinates based on its points, angle, and scale
   */
  _calculateCoords () {
    const x = this.x
    const y = this.y
    const angle = this.angle
    const scale_x = this.scale_x
    const scale_y = this.scale_y
    const points = this._points
    const coords = this._coords
    const count = points.length

    let min_x
    let max_x
    let min_y
    let max_y

    for (let ix = 0, iy = 1; ix < count; ix += 2, iy += 2) {
      let coord_x = points[ix] * scale_x
      let coord_y = points[iy] * scale_y

      if (angle) {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const tmp_x = coord_x
        const tmp_y = coord_y

        coord_x = tmp_x * cos - tmp_y * sin
        coord_y = tmp_x * sin + tmp_y * cos
      }

      coord_x += x
      coord_y += y

      coords[ix] = coord_x
      coords[iy] = coord_y

      if (ix === 0) {
        min_x = max_x = coord_x
        min_y = max_y = coord_y
      } else {
        if (coord_x < min_x) {
          min_x = coord_x
        } else if (coord_x > max_x) {
          max_x = coord_x
        }

        if (coord_y < min_y) {
          min_y = coord_y
        } else if (coord_y > max_y) {
          max_y = coord_y
        }
      }
    }

    this._x = x
    this._y = y
    this._angle = angle
    this._scale_x = scale_x
    this._scale_y = scale_y
    this._min_x = min_x
    this._min_y = min_y
    this._max_x = max_x
    this._max_y = max_y
    this._dirty_coords = false
    this._dirty_normals = true
  }

  /**
   * Calculates the normals and edges of the polygon's sides
   */
  _calculateNormals () {
    const coords = this._coords
    const edges = this._edges
    const normals = this._normals
    const count = coords.length

    for (let ix = 0, iy = 1; ix < count; ix += 2, iy += 2) {
      const next = ix + 2 < count ? ix + 2 : 0
      const x = coords[next] - coords[ix]
      const y = coords[next + 1] - coords[iy]
      const length = x || y ? Math.sqrt(x * x + y * y) : 0

      edges[ix] = x
      edges[iy] = y
      normals[ix] = length ? y / length : 0
      normals[iy] = length ? -x / length : 0
    }

    this._dirty_normals = false
  }
};

module.exports = Polygon

module.exports.default = module.exports

},{"./Body":39}],43:[function(require,module,exports){
/**
 * An object used to collect the detailed results of a collision test
 *
 * > **Note:** It is highly recommended you recycle the same Result object if possible in order to avoid wasting memory
 * @class
 */
class Result {
  /**
   * @constructor
   */
  constructor () {
    /**
     * @desc True if a collision was detected
     * @type {Boolean}
     */
    this.collision = false

    /**
     * @desc The source body tested
     * @type {Circle|Polygon|Point}
     */
    this.a = null

    /**
     * @desc The target body tested against
     * @type {Circle|Polygon|Point}
     */
    this.b = null

    /**
     * @desc True if A is completely contained within B
     * @type {Boolean}
     */
    this.a_in_b = false

    /**
     * @desc True if B is completely contained within A
     * @type {Boolean}
     */
    this.b_in_a = false

    /**
     * @desc The magnitude of the shortest axis of overlap
     * @type {Number}
     */
    this.overlap = 0

    /**
     * @desc The X direction of the shortest axis of overlap
     * @type {Number}
     */
    this.overlap_x = 0

    /**
     * @desc The Y direction of the shortest axis of overlap
     * @type {Number}
     */
    this.overlap_y = 0
  }
};

module.exports = Result

module.exports.default = module.exports

},{}],44:[function(require,module,exports){
/**
 * Determines if two bodies are colliding using the Separating Axis Theorem
 * @private
 * @param {Circle|Polygon|Point} a The source body to test
 * @param {Circle|Polygon|Point} b The target body to test against
 * @param {Result} [result = null] A Result object on which to store information about the collision
 * @param {Boolean} [aabb = true] Set to false to skip the AABB test (useful if you use your own collision heuristic)
 * @returns {Boolean}
 */
function SAT (a, b, result = null, aabb = true) {
  const a_polygon = a._polygon
  const b_polygon = b._polygon

  let collision = false

  if (result) {
    result.a = a
    result.b = b
    result.a_in_b = true
    result.b_in_a = true
    result.overlap = null
    result.overlap_x = 0
    result.overlap_y = 0
  }

  if (a_polygon) {
    if (
      a._dirty_coords ||
      a.x !== a._x ||
      a.y !== a._y ||
      a.angle !== a._angle ||
      a.scale_x !== a._scale_x ||
      a.scale_y !== a._scale_y
    ) {
      a._calculateCoords()
    }
  }

  if (b_polygon) {
    if (
      b._dirty_coords ||
      b.x !== b._x ||
      b.y !== b._y ||
      b.angle !== b._angle ||
      b.scale_x !== b._scale_x ||
      b.scale_y !== b._scale_y
    ) {
      b._calculateCoords()
    }
  }

  if (!aabb || aabbAABB(a, b)) {
    if (a_polygon && a._dirty_normals) {
      a._calculateNormals()
    }

    if (b_polygon && b._dirty_normals) {
      b._calculateNormals()
    }

    collision = (
      a_polygon && b_polygon ? polygonPolygon(a, b, result)
        : a_polygon ? polygonCircle(a, b, result, false)
          : b_polygon ? polygonCircle(b, a, result, true)
            : circleCircle(a, b, result)
    )
  }

  if (result) {
    result.collision = collision
  }

  return collision
};

/**
 * Determines if two bodies' axis aligned bounding boxes are colliding
 * @param {Circle|Polygon|Point} a The source body to test
 * @param {Circle|Polygon|Point} b The target body to test against
 */
function aabbAABB (a, b) {
  const a_polygon = a._polygon
  const a_x = a_polygon ? 0 : a.x
  const a_y = a_polygon ? 0 : a.y
  const a_radius = a_polygon ? 0 : a.radius * a.scale
  const a_min_x = a_polygon ? a._min_x : a_x - a_radius
  const a_min_y = a_polygon ? a._min_y : a_y - a_radius
  const a_max_x = a_polygon ? a._max_x : a_x + a_radius
  const a_max_y = a_polygon ? a._max_y : a_y + a_radius

  const b_polygon = b._polygon
  const b_x = b_polygon ? 0 : b.x
  const b_y = b_polygon ? 0 : b.y
  const b_radius = b_polygon ? 0 : b.radius * b.scale
  const b_min_x = b_polygon ? b._min_x : b_x - b_radius
  const b_min_y = b_polygon ? b._min_y : b_y - b_radius
  const b_max_x = b_polygon ? b._max_x : b_x + b_radius
  const b_max_y = b_polygon ? b._max_y : b_y + b_radius

  return a_min_x < b_max_x && a_min_y < b_max_y && a_max_x > b_min_x && a_max_y > b_min_y
}

/**
 * Determines if two polygons are colliding
 * @param {Polygon} a The source polygon to test
 * @param {Polygon} b The target polygon to test against
 * @param {Result} [result = null] A Result object on which to store information about the collision
 * @returns {Boolean}
 */
function polygonPolygon (a, b, result = null) {
  const a_count = a._coords.length
  const b_count = b._coords.length

  // Handle points specially
  if (a_count === 2 && b_count === 2) {
    const a_coords = a._coords
    const b_coords = b._coords

    if (result) {
      result.overlap = 0
    }

    return a_coords[0] === b_coords[0] && a_coords[1] === b_coords[1]
  }

  const a_coords = a._coords
  const b_coords = b._coords
  const a_normals = a._normals
  const b_normals = b._normals

  if (a_count > 2) {
    for (let ix = 0, iy = 1; ix < a_count; ix += 2, iy += 2) {
      if (separatingAxis(a_coords, b_coords, a_normals[ix], a_normals[iy], result)) {
        return false
      }
    }
  }

  if (b_count > 2) {
    for (let ix = 0, iy = 1; ix < b_count; ix += 2, iy += 2) {
      if (separatingAxis(a_coords, b_coords, b_normals[ix], b_normals[iy], result)) {
        return false
      }
    }
  }

  return true
}

/**
 * Determines if a polygon and a circle are colliding
 * @param {Polygon} a The source polygon to test
 * @param {Circle} b The target circle to test against
 * @param {Result} [result = null] A Result object on which to store information about the collision
 * @param {Boolean} [reverse = false] Set to true to reverse a and b in the result parameter when testing circle->polygon instead of polygon->circle
 * @returns {Boolean}
 */
function polygonCircle (a, b, result = null, reverse = false) {
  const a_coords = a._coords
  const a_edges = a._edges
  const a_normals = a._normals
  const b_x = b.x
  const b_y = b.y
  const b_radius = b.radius * b.scale
  const b_radius2 = b_radius * 2
  const radius_squared = b_radius * b_radius
  const count = a_coords.length

  let a_in_b = true
  let b_in_a = true
  let overlap = null
  let overlap_x = 0
  let overlap_y = 0

  // Handle points specially
  if (count === 2) {
    const coord_x = b_x - a_coords[0]
    const coord_y = b_y - a_coords[1]
    const length_squared = coord_x * coord_x + coord_y * coord_y

    if (length_squared > radius_squared) {
      return false
    }

    if (result) {
      const length = Math.sqrt(length_squared)

      overlap = b_radius - length
      overlap_x = coord_x / length
      overlap_y = coord_y / length
      b_in_a = false
    }
  } else {
    for (let ix = 0, iy = 1; ix < count; ix += 2, iy += 2) {
      const coord_x = b_x - a_coords[ix]
      const coord_y = b_y - a_coords[iy]
      const edge_x = a_edges[ix]
      const edge_y = a_edges[iy]
      const dot = coord_x * edge_x + coord_y * edge_y
      const region = dot < 0 ? -1 : dot > edge_x * edge_x + edge_y * edge_y ? 1 : 0

      let tmp_overlapping = false
      let tmp_overlap = 0
      let tmp_overlap_x = 0
      let tmp_overlap_y = 0

      if (result && a_in_b && coord_x * coord_x + coord_y * coord_y > radius_squared) {
        a_in_b = false
      }

      if (region) {
        const left = region === -1
        const other_x = left ? (ix === 0 ? count - 2 : ix - 2) : (ix === count - 2 ? 0 : ix + 2)
        const other_y = other_x + 1
        const coord2_x = b_x - a_coords[other_x]
        const coord2_y = b_y - a_coords[other_y]
        const edge2_x = a_edges[other_x]
        const edge2_y = a_edges[other_y]
        const dot2 = coord2_x * edge2_x + coord2_y * edge2_y
        const region2 = dot2 < 0 ? -1 : dot2 > edge2_x * edge2_x + edge2_y * edge2_y ? 1 : 0

        if (region2 === -region) {
          const target_x = left ? coord_x : coord2_x
          const target_y = left ? coord_y : coord2_y
          const length_squared = target_x * target_x + target_y * target_y

          if (length_squared > radius_squared) {
            return false
          }

          if (result) {
            const length = Math.sqrt(length_squared)

            tmp_overlapping = true
            tmp_overlap = b_radius - length
            tmp_overlap_x = target_x / length
            tmp_overlap_y = target_y / length
            b_in_a = false
          }
        }
      } else {
        const normal_x = a_normals[ix]
        const normal_y = a_normals[iy]
        const length = coord_x * normal_x + coord_y * normal_y
        const absolute_length = length < 0 ? -length : length

        if (length > 0 && absolute_length > b_radius) {
          return false
        }

        if (result) {
          tmp_overlapping = true
          tmp_overlap = b_radius - length
          tmp_overlap_x = normal_x
          tmp_overlap_y = normal_y

          if (b_in_a && (length >= 0) || (tmp_overlap < b_radius2)) {
            b_in_a = false
          }
        }
      }

      if (tmp_overlapping && (overlap === null || overlap > tmp_overlap)) {
        overlap = tmp_overlap
        overlap_x = tmp_overlap_x
        overlap_y = tmp_overlap_y
      }
    }
  }

  if (result) {
    result.a_in_b = reverse ? b_in_a : a_in_b
    result.b_in_a = reverse ? a_in_b : b_in_a
    result.overlap = overlap
    result.overlap_x = reverse ? -overlap_x : overlap_x
    result.overlap_y = reverse ? -overlap_y : overlap_y
  }

  return true
}

/**
 * Determines if two circles are colliding
 * @param {Circle} a The source circle to test
 * @param {Circle} b The target circle to test against
 * @param {Result} [result = null] A Result object on which to store information about the collision
 * @returns {Boolean}
 */
function circleCircle (a, b, result = null) {
  const a_radius = a.radius * a.scale
  const b_radius = b.radius * b.scale
  const difference_x = b.x - a.x
  const difference_y = b.y - a.y
  const radius_sum = a_radius + b_radius
  const length_squared = difference_x * difference_x + difference_y * difference_y

  if (length_squared > radius_sum * radius_sum) {
    return false
  }

  if (result) {
    const length = Math.sqrt(length_squared)

    result.a_in_b = a_radius <= b_radius && length <= b_radius - a_radius
    result.b_in_a = b_radius <= a_radius && length <= a_radius - b_radius
    result.overlap = radius_sum - length
    result.overlap_x = difference_x / length
    result.overlap_y = difference_y / length
  }

  return true
}

/**
 * Determines if two polygons are separated by an axis
 * @param {Array<Number[]>} a_coords The coordinates of the polygon to test
 * @param {Array<Number[]>} b_coords The coordinates of the polygon to test against
 * @param {Number} x The X direction of the axis
 * @param {Number} y The Y direction of the axis
 * @param {Result} [result = null] A Result object on which to store information about the collision
 * @returns {Boolean}
 */
function separatingAxis (a_coords, b_coords, x, y, result = null) {
  const a_count = a_coords.length
  const b_count = b_coords.length

  if (!a_count || !b_count) {
    return true
  }

  let a_start = null
  let a_end = null
  let b_start = null
  let b_end = null

  for (let ix = 0, iy = 1; ix < a_count; ix += 2, iy += 2) {
    const dot = a_coords[ix] * x + a_coords[iy] * y

    if (a_start === null || a_start > dot) {
      a_start = dot
    }

    if (a_end === null || a_end < dot) {
      a_end = dot
    }
  }

  for (let ix = 0, iy = 1; ix < b_count; ix += 2, iy += 2) {
    const dot = b_coords[ix] * x + b_coords[iy] * y

    if (b_start === null || b_start > dot) {
      b_start = dot
    }

    if (b_end === null || b_end < dot) {
      b_end = dot
    }
  }

  if (a_start > b_end || a_end < b_start) {
    return true
  }

  if (result) {
    let overlap = 0

    if (a_start < b_start) {
      result.a_in_b = false

      if (a_end < b_end) {
        overlap = a_end - b_start
        result.b_in_a = false
      } else {
        const option1 = a_end - b_start
        const option2 = b_end - a_start

        overlap = option1 < option2 ? option1 : -option2
      }
    } else {
      result.b_in_a = false

      if (a_end > b_end) {
        overlap = a_start - b_end
        result.a_in_b = false
      } else {
        const option1 = a_end - b_start
        const option2 = b_end - a_start

        overlap = option1 < option2 ? option1 : -option2
      }
    }

    const current_overlap = result.overlap
    const absolute_overlap = overlap < 0 ? -overlap : overlap

    if (current_overlap === null || current_overlap > absolute_overlap) {
      const sign = overlap < 0 ? -1 : 1

      result.overlap = absolute_overlap
      result.overlap_x = x * sign
      result.overlap_y = y * sign
    }
  }

  return false
}

module.exports = SAT

module.exports.default = module.exports

},{}],45:[function(require,module,exports){

module.exports = require('./socket');

/**
 * Exports parser
 *
 * @api public
 *
 */
module.exports.parser = require('engine.io-parser');

},{"./socket":46,"engine.io-parser":56}],46:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var transports = require('./transports/index');
var Emitter = require('component-emitter');
var debug = require('debug')('engine.io-client:socket');
var index = require('indexof');
var parser = require('engine.io-parser');
var parseuri = require('parseuri');
var parseqs = require('parseqs');

/**
 * Module exports.
 */

module.exports = Socket;

/**
 * Socket constructor.
 *
 * @param {String|Object} uri or options
 * @param {Object} options
 * @api public
 */

function Socket (uri, opts) {
  if (!(this instanceof Socket)) return new Socket(uri, opts);

  opts = opts || {};

  if (uri && 'object' === typeof uri) {
    opts = uri;
    uri = null;
  }

  if (uri) {
    uri = parseuri(uri);
    opts.hostname = uri.host;
    opts.secure = uri.protocol === 'https' || uri.protocol === 'wss';
    opts.port = uri.port;
    if (uri.query) opts.query = uri.query;
  } else if (opts.host) {
    opts.hostname = parseuri(opts.host).host;
  }

  this.secure = null != opts.secure ? opts.secure
    : (global.location && 'https:' === location.protocol);

  if (opts.hostname && !opts.port) {
    // if no port is specified manually, use the protocol default
    opts.port = this.secure ? '443' : '80';
  }

  this.agent = opts.agent || false;
  this.hostname = opts.hostname ||
    (global.location ? location.hostname : 'localhost');
  this.port = opts.port || (global.location && location.port
      ? location.port
      : (this.secure ? 443 : 80));
  this.query = opts.query || {};
  if ('string' === typeof this.query) this.query = parseqs.decode(this.query);
  this.upgrade = false !== opts.upgrade;
  this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
  this.forceJSONP = !!opts.forceJSONP;
  this.jsonp = false !== opts.jsonp;
  this.forceBase64 = !!opts.forceBase64;
  this.enablesXDR = !!opts.enablesXDR;
  this.timestampParam = opts.timestampParam || 't';
  this.timestampRequests = opts.timestampRequests;
  this.transports = opts.transports || ['polling', 'websocket'];
  this.transportOptions = opts.transportOptions || {};
  this.readyState = '';
  this.writeBuffer = [];
  this.prevBufferLen = 0;
  this.policyPort = opts.policyPort || 843;
  this.rememberUpgrade = opts.rememberUpgrade || false;
  this.binaryType = null;
  this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;
  this.perMessageDeflate = false !== opts.perMessageDeflate ? (opts.perMessageDeflate || {}) : false;

  if (true === this.perMessageDeflate) this.perMessageDeflate = {};
  if (this.perMessageDeflate && null == this.perMessageDeflate.threshold) {
    this.perMessageDeflate.threshold = 1024;
  }

  // SSL options for Node.js client
  this.pfx = opts.pfx || null;
  this.key = opts.key || null;
  this.passphrase = opts.passphrase || null;
  this.cert = opts.cert || null;
  this.ca = opts.ca || null;
  this.ciphers = opts.ciphers || null;
  this.rejectUnauthorized = opts.rejectUnauthorized === undefined ? true : opts.rejectUnauthorized;
  this.forceNode = !!opts.forceNode;

  // other options for Node.js client
  var freeGlobal = typeof global === 'object' && global;
  if (freeGlobal.global === freeGlobal) {
    if (opts.extraHeaders && Object.keys(opts.extraHeaders).length > 0) {
      this.extraHeaders = opts.extraHeaders;
    }

    if (opts.localAddress) {
      this.localAddress = opts.localAddress;
    }
  }

  // set on handshake
  this.id = null;
  this.upgrades = null;
  this.pingInterval = null;
  this.pingTimeout = null;

  // set on heartbeat
  this.pingIntervalTimer = null;
  this.pingTimeoutTimer = null;

  this.open();
}

Socket.priorWebsocketSuccess = false;

/**
 * Mix in `Emitter`.
 */

Emitter(Socket.prototype);

/**
 * Protocol version.
 *
 * @api public
 */

Socket.protocol = parser.protocol; // this is an int

/**
 * Expose deps for legacy compatibility
 * and standalone browser access.
 */

Socket.Socket = Socket;
Socket.Transport = require('./transport');
Socket.transports = require('./transports/index');
Socket.parser = require('engine.io-parser');

/**
 * Creates transport of the given type.
 *
 * @param {String} transport name
 * @return {Transport}
 * @api private
 */

Socket.prototype.createTransport = function (name) {
  debug('creating transport "%s"', name);
  var query = clone(this.query);

  // append engine.io protocol identifier
  query.EIO = parser.protocol;

  // transport name
  query.transport = name;

  // per-transport options
  var options = this.transportOptions[name] || {};

  // session id if we already have one
  if (this.id) query.sid = this.id;

  var transport = new transports[name]({
    query: query,
    socket: this,
    agent: options.agent || this.agent,
    hostname: options.hostname || this.hostname,
    port: options.port || this.port,
    secure: options.secure || this.secure,
    path: options.path || this.path,
    forceJSONP: options.forceJSONP || this.forceJSONP,
    jsonp: options.jsonp || this.jsonp,
    forceBase64: options.forceBase64 || this.forceBase64,
    enablesXDR: options.enablesXDR || this.enablesXDR,
    timestampRequests: options.timestampRequests || this.timestampRequests,
    timestampParam: options.timestampParam || this.timestampParam,
    policyPort: options.policyPort || this.policyPort,
    pfx: options.pfx || this.pfx,
    key: options.key || this.key,
    passphrase: options.passphrase || this.passphrase,
    cert: options.cert || this.cert,
    ca: options.ca || this.ca,
    ciphers: options.ciphers || this.ciphers,
    rejectUnauthorized: options.rejectUnauthorized || this.rejectUnauthorized,
    perMessageDeflate: options.perMessageDeflate || this.perMessageDeflate,
    extraHeaders: options.extraHeaders || this.extraHeaders,
    forceNode: options.forceNode || this.forceNode,
    localAddress: options.localAddress || this.localAddress,
    requestTimeout: options.requestTimeout || this.requestTimeout,
    protocols: options.protocols || void (0)
  });

  return transport;
};

function clone (obj) {
  var o = {};
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      o[i] = obj[i];
    }
  }
  return o;
}

/**
 * Initializes transport to use and starts probe.
 *
 * @api private
 */
Socket.prototype.open = function () {
  var transport;
  if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf('websocket') !== -1) {
    transport = 'websocket';
  } else if (0 === this.transports.length) {
    // Emit error on next tick so it can be listened to
    var self = this;
    setTimeout(function () {
      self.emit('error', 'No transports available');
    }, 0);
    return;
  } else {
    transport = this.transports[0];
  }
  this.readyState = 'opening';

  // Retry with the next transport if the transport is disabled (jsonp: false)
  try {
    transport = this.createTransport(transport);
  } catch (e) {
    this.transports.shift();
    this.open();
    return;
  }

  transport.open();
  this.setTransport(transport);
};

/**
 * Sets the current transport. Disables the existing one (if any).
 *
 * @api private
 */

Socket.prototype.setTransport = function (transport) {
  debug('setting transport %s', transport.name);
  var self = this;

  if (this.transport) {
    debug('clearing existing transport %s', this.transport.name);
    this.transport.removeAllListeners();
  }

  // set up transport
  this.transport = transport;

  // set up transport listeners
  transport
  .on('drain', function () {
    self.onDrain();
  })
  .on('packet', function (packet) {
    self.onPacket(packet);
  })
  .on('error', function (e) {
    self.onError(e);
  })
  .on('close', function () {
    self.onClose('transport close');
  });
};

/**
 * Probes a transport.
 *
 * @param {String} transport name
 * @api private
 */

Socket.prototype.probe = function (name) {
  debug('probing transport "%s"', name);
  var transport = this.createTransport(name, { probe: 1 });
  var failed = false;
  var self = this;

  Socket.priorWebsocketSuccess = false;

  function onTransportOpen () {
    if (self.onlyBinaryUpgrades) {
      var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
      failed = failed || upgradeLosesBinary;
    }
    if (failed) return;

    debug('probe transport "%s" opened', name);
    transport.send([{ type: 'ping', data: 'probe' }]);
    transport.once('packet', function (msg) {
      if (failed) return;
      if ('pong' === msg.type && 'probe' === msg.data) {
        debug('probe transport "%s" pong', name);
        self.upgrading = true;
        self.emit('upgrading', transport);
        if (!transport) return;
        Socket.priorWebsocketSuccess = 'websocket' === transport.name;

        debug('pausing current transport "%s"', self.transport.name);
        self.transport.pause(function () {
          if (failed) return;
          if ('closed' === self.readyState) return;
          debug('changing transport and sending upgrade packet');

          cleanup();

          self.setTransport(transport);
          transport.send([{ type: 'upgrade' }]);
          self.emit('upgrade', transport);
          transport = null;
          self.upgrading = false;
          self.flush();
        });
      } else {
        debug('probe transport "%s" failed', name);
        var err = new Error('probe error');
        err.transport = transport.name;
        self.emit('upgradeError', err);
      }
    });
  }

  function freezeTransport () {
    if (failed) return;

    // Any callback called by transport should be ignored since now
    failed = true;

    cleanup();

    transport.close();
    transport = null;
  }

  // Handle any error that happens while probing
  function onerror (err) {
    var error = new Error('probe error: ' + err);
    error.transport = transport.name;

    freezeTransport();

    debug('probe transport "%s" failed because of error: %s', name, err);

    self.emit('upgradeError', error);
  }

  function onTransportClose () {
    onerror('transport closed');
  }

  // When the socket is closed while we're probing
  function onclose () {
    onerror('socket closed');
  }

  // When the socket is upgraded while we're probing
  function onupgrade (to) {
    if (transport && to.name !== transport.name) {
      debug('"%s" works - aborting "%s"', to.name, transport.name);
      freezeTransport();
    }
  }

  // Remove all listeners on the transport and on self
  function cleanup () {
    transport.removeListener('open', onTransportOpen);
    transport.removeListener('error', onerror);
    transport.removeListener('close', onTransportClose);
    self.removeListener('close', onclose);
    self.removeListener('upgrading', onupgrade);
  }

  transport.once('open', onTransportOpen);
  transport.once('error', onerror);
  transport.once('close', onTransportClose);

  this.once('close', onclose);
  this.once('upgrading', onupgrade);

  transport.open();
};

/**
 * Called when connection is deemed open.
 *
 * @api public
 */

Socket.prototype.onOpen = function () {
  debug('socket open');
  this.readyState = 'open';
  Socket.priorWebsocketSuccess = 'websocket' === this.transport.name;
  this.emit('open');
  this.flush();

  // we check for `readyState` in case an `open`
  // listener already closed the socket
  if ('open' === this.readyState && this.upgrade && this.transport.pause) {
    debug('starting upgrade probes');
    for (var i = 0, l = this.upgrades.length; i < l; i++) {
      this.probe(this.upgrades[i]);
    }
  }
};

/**
 * Handles a packet.
 *
 * @api private
 */

Socket.prototype.onPacket = function (packet) {
  if ('opening' === this.readyState || 'open' === this.readyState ||
      'closing' === this.readyState) {
    debug('socket receive: type "%s", data "%s"', packet.type, packet.data);

    this.emit('packet', packet);

    // Socket is live - any packet counts
    this.emit('heartbeat');

    switch (packet.type) {
      case 'open':
        this.onHandshake(JSON.parse(packet.data));
        break;

      case 'pong':
        this.setPing();
        this.emit('pong');
        break;

      case 'error':
        var err = new Error('server error');
        err.code = packet.data;
        this.onError(err);
        break;

      case 'message':
        this.emit('data', packet.data);
        this.emit('message', packet.data);
        break;
    }
  } else {
    debug('packet received with socket readyState "%s"', this.readyState);
  }
};

/**
 * Called upon handshake completion.
 *
 * @param {Object} handshake obj
 * @api private
 */

Socket.prototype.onHandshake = function (data) {
  this.emit('handshake', data);
  this.id = data.sid;
  this.transport.query.sid = data.sid;
  this.upgrades = this.filterUpgrades(data.upgrades);
  this.pingInterval = data.pingInterval;
  this.pingTimeout = data.pingTimeout;
  this.onOpen();
  // In case open handler closes socket
  if ('closed' === this.readyState) return;
  this.setPing();

  // Prolong liveness of socket on heartbeat
  this.removeListener('heartbeat', this.onHeartbeat);
  this.on('heartbeat', this.onHeartbeat);
};

/**
 * Resets ping timeout.
 *
 * @api private
 */

Socket.prototype.onHeartbeat = function (timeout) {
  clearTimeout(this.pingTimeoutTimer);
  var self = this;
  self.pingTimeoutTimer = setTimeout(function () {
    if ('closed' === self.readyState) return;
    self.onClose('ping timeout');
  }, timeout || (self.pingInterval + self.pingTimeout));
};

/**
 * Pings server every `this.pingInterval` and expects response
 * within `this.pingTimeout` or closes connection.
 *
 * @api private
 */

Socket.prototype.setPing = function () {
  var self = this;
  clearTimeout(self.pingIntervalTimer);
  self.pingIntervalTimer = setTimeout(function () {
    debug('writing ping packet - expecting pong within %sms', self.pingTimeout);
    self.ping();
    self.onHeartbeat(self.pingTimeout);
  }, self.pingInterval);
};

/**
* Sends a ping packet.
*
* @api private
*/

Socket.prototype.ping = function () {
  var self = this;
  this.sendPacket('ping', function () {
    self.emit('ping');
  });
};

/**
 * Called on `drain` event
 *
 * @api private
 */

Socket.prototype.onDrain = function () {
  this.writeBuffer.splice(0, this.prevBufferLen);

  // setting prevBufferLen = 0 is very important
  // for example, when upgrading, upgrade packet is sent over,
  // and a nonzero prevBufferLen could cause problems on `drain`
  this.prevBufferLen = 0;

  if (0 === this.writeBuffer.length) {
    this.emit('drain');
  } else {
    this.flush();
  }
};

/**
 * Flush write buffers.
 *
 * @api private
 */

Socket.prototype.flush = function () {
  if ('closed' !== this.readyState && this.transport.writable &&
    !this.upgrading && this.writeBuffer.length) {
    debug('flushing %d packets in socket', this.writeBuffer.length);
    this.transport.send(this.writeBuffer);
    // keep track of current length of writeBuffer
    // splice writeBuffer and callbackBuffer on `drain`
    this.prevBufferLen = this.writeBuffer.length;
    this.emit('flush');
  }
};

/**
 * Sends a message.
 *
 * @param {String} message.
 * @param {Function} callback function.
 * @param {Object} options.
 * @return {Socket} for chaining.
 * @api public
 */

Socket.prototype.write =
Socket.prototype.send = function (msg, options, fn) {
  this.sendPacket('message', msg, options, fn);
  return this;
};

/**
 * Sends a packet.
 *
 * @param {String} packet type.
 * @param {String} data.
 * @param {Object} options.
 * @param {Function} callback function.
 * @api private
 */

Socket.prototype.sendPacket = function (type, data, options, fn) {
  if ('function' === typeof data) {
    fn = data;
    data = undefined;
  }

  if ('function' === typeof options) {
    fn = options;
    options = null;
  }

  if ('closing' === this.readyState || 'closed' === this.readyState) {
    return;
  }

  options = options || {};
  options.compress = false !== options.compress;

  var packet = {
    type: type,
    data: data,
    options: options
  };
  this.emit('packetCreate', packet);
  this.writeBuffer.push(packet);
  if (fn) this.once('flush', fn);
  this.flush();
};

/**
 * Closes the connection.
 *
 * @api private
 */

Socket.prototype.close = function () {
  if ('opening' === this.readyState || 'open' === this.readyState) {
    this.readyState = 'closing';

    var self = this;

    if (this.writeBuffer.length) {
      this.once('drain', function () {
        if (this.upgrading) {
          waitForUpgrade();
        } else {
          close();
        }
      });
    } else if (this.upgrading) {
      waitForUpgrade();
    } else {
      close();
    }
  }

  function close () {
    self.onClose('forced close');
    debug('socket closing - telling transport to close');
    self.transport.close();
  }

  function cleanupAndClose () {
    self.removeListener('upgrade', cleanupAndClose);
    self.removeListener('upgradeError', cleanupAndClose);
    close();
  }

  function waitForUpgrade () {
    // wait for upgrade to finish since we can't send packets while pausing a transport
    self.once('upgrade', cleanupAndClose);
    self.once('upgradeError', cleanupAndClose);
  }

  return this;
};

/**
 * Called upon transport error
 *
 * @api private
 */

Socket.prototype.onError = function (err) {
  debug('socket error %j', err);
  Socket.priorWebsocketSuccess = false;
  this.emit('error', err);
  this.onClose('transport error', err);
};

/**
 * Called upon transport close.
 *
 * @api private
 */

Socket.prototype.onClose = function (reason, desc) {
  if ('opening' === this.readyState || 'open' === this.readyState || 'closing' === this.readyState) {
    debug('socket close with reason: "%s"', reason);
    var self = this;

    // clear timers
    clearTimeout(this.pingIntervalTimer);
    clearTimeout(this.pingTimeoutTimer);

    // stop event from firing again for transport
    this.transport.removeAllListeners('close');

    // ensure transport won't stay open
    this.transport.close();

    // ignore further transport communication
    this.transport.removeAllListeners();

    // set ready state
    this.readyState = 'closed';

    // clear session id
    this.id = null;

    // emit close event
    this.emit('close', reason, desc);

    // clean buffers after, so users can still
    // grab the buffers on `close` event
    self.writeBuffer = [];
    self.prevBufferLen = 0;
  }
};

/**
 * Filters upgrades, returning only those matching client transports.
 *
 * @param {Array} server upgrades
 * @api private
 *
 */

Socket.prototype.filterUpgrades = function (upgrades) {
  var filteredUpgrades = [];
  for (var i = 0, j = upgrades.length; i < j; i++) {
    if (~index(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
  }
  return filteredUpgrades;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./transport":47,"./transports/index":48,"component-emitter":34,"debug":54,"engine.io-parser":56,"indexof":62,"parseqs":68,"parseuri":69}],47:[function(require,module,exports){
/**
 * Module dependencies.
 */

var parser = require('engine.io-parser');
var Emitter = require('component-emitter');

/**
 * Module exports.
 */

module.exports = Transport;

/**
 * Transport abstract constructor.
 *
 * @param {Object} options.
 * @api private
 */

function Transport (opts) {
  this.path = opts.path;
  this.hostname = opts.hostname;
  this.port = opts.port;
  this.secure = opts.secure;
  this.query = opts.query;
  this.timestampParam = opts.timestampParam;
  this.timestampRequests = opts.timestampRequests;
  this.readyState = '';
  this.agent = opts.agent || false;
  this.socket = opts.socket;
  this.enablesXDR = opts.enablesXDR;

  // SSL options for Node.js client
  this.pfx = opts.pfx;
  this.key = opts.key;
  this.passphrase = opts.passphrase;
  this.cert = opts.cert;
  this.ca = opts.ca;
  this.ciphers = opts.ciphers;
  this.rejectUnauthorized = opts.rejectUnauthorized;
  this.forceNode = opts.forceNode;

  // other options for Node.js client
  this.extraHeaders = opts.extraHeaders;
  this.localAddress = opts.localAddress;
}

/**
 * Mix in `Emitter`.
 */

Emitter(Transport.prototype);

/**
 * Emits an error.
 *
 * @param {String} str
 * @return {Transport} for chaining
 * @api public
 */

Transport.prototype.onError = function (msg, desc) {
  var err = new Error(msg);
  err.type = 'TransportError';
  err.description = desc;
  this.emit('error', err);
  return this;
};

/**
 * Opens the transport.
 *
 * @api public
 */

Transport.prototype.open = function () {
  if ('closed' === this.readyState || '' === this.readyState) {
    this.readyState = 'opening';
    this.doOpen();
  }

  return this;
};

/**
 * Closes the transport.
 *
 * @api private
 */

Transport.prototype.close = function () {
  if ('opening' === this.readyState || 'open' === this.readyState) {
    this.doClose();
    this.onClose();
  }

  return this;
};

/**
 * Sends multiple packets.
 *
 * @param {Array} packets
 * @api private
 */

Transport.prototype.send = function (packets) {
  if ('open' === this.readyState) {
    this.write(packets);
  } else {
    throw new Error('Transport not open');
  }
};

/**
 * Called upon open
 *
 * @api private
 */

Transport.prototype.onOpen = function () {
  this.readyState = 'open';
  this.writable = true;
  this.emit('open');
};

/**
 * Called with data.
 *
 * @param {String} data
 * @api private
 */

Transport.prototype.onData = function (data) {
  var packet = parser.decodePacket(data, this.socket.binaryType);
  this.onPacket(packet);
};

/**
 * Called with a decoded packet.
 */

Transport.prototype.onPacket = function (packet) {
  this.emit('packet', packet);
};

/**
 * Called upon close.
 *
 * @api private
 */

Transport.prototype.onClose = function () {
  this.readyState = 'closed';
  this.emit('close');
};

},{"component-emitter":34,"engine.io-parser":56}],48:[function(require,module,exports){
(function (global){
/**
 * Module dependencies
 */

var XMLHttpRequest = require('xmlhttprequest-ssl');
var XHR = require('./polling-xhr');
var JSONP = require('./polling-jsonp');
var websocket = require('./websocket');

/**
 * Export transports.
 */

exports.polling = polling;
exports.websocket = websocket;

/**
 * Polling transport polymorphic constructor.
 * Decides on xhr vs jsonp based on feature detection.
 *
 * @api private
 */

function polling (opts) {
  var xhr;
  var xd = false;
  var xs = false;
  var jsonp = false !== opts.jsonp;

  if (global.location) {
    var isSSL = 'https:' === location.protocol;
    var port = location.port;

    // some user agents have empty `location.port`
    if (!port) {
      port = isSSL ? 443 : 80;
    }

    xd = opts.hostname !== location.hostname || port !== opts.port;
    xs = opts.secure !== isSSL;
  }

  opts.xdomain = xd;
  opts.xscheme = xs;
  xhr = new XMLHttpRequest(opts);

  if ('open' in xhr && !opts.forceJSONP) {
    return new XHR(opts);
  } else {
    if (!jsonp) throw new Error('JSONP disabled');
    return new JSONP(opts);
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling-jsonp":49,"./polling-xhr":50,"./websocket":52,"xmlhttprequest-ssl":53}],49:[function(require,module,exports){
(function (global){

/**
 * Module requirements.
 */

var Polling = require('./polling');
var inherit = require('component-inherit');

/**
 * Module exports.
 */

module.exports = JSONPPolling;

/**
 * Cached regular expressions.
 */

var rNewline = /\n/g;
var rEscapedNewline = /\\n/g;

/**
 * Global JSONP callbacks.
 */

var callbacks;

/**
 * Noop.
 */

function empty () { }

/**
 * JSONP Polling constructor.
 *
 * @param {Object} opts.
 * @api public
 */

function JSONPPolling (opts) {
  Polling.call(this, opts);

  this.query = this.query || {};

  // define global callbacks array if not present
  // we do this here (lazily) to avoid unneeded global pollution
  if (!callbacks) {
    // we need to consider multiple engines in the same page
    if (!global.___eio) global.___eio = [];
    callbacks = global.___eio;
  }

  // callback identifier
  this.index = callbacks.length;

  // add callback to jsonp global
  var self = this;
  callbacks.push(function (msg) {
    self.onData(msg);
  });

  // append to query string
  this.query.j = this.index;

  // prevent spurious errors from being emitted when the window is unloaded
  if (global.document && global.addEventListener) {
    global.addEventListener('beforeunload', function () {
      if (self.script) self.script.onerror = empty;
    }, false);
  }
}

/**
 * Inherits from Polling.
 */

inherit(JSONPPolling, Polling);

/*
 * JSONP only supports binary as base64 encoded strings
 */

JSONPPolling.prototype.supportsBinary = false;

/**
 * Closes the socket.
 *
 * @api private
 */

JSONPPolling.prototype.doClose = function () {
  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  if (this.form) {
    this.form.parentNode.removeChild(this.form);
    this.form = null;
    this.iframe = null;
  }

  Polling.prototype.doClose.call(this);
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

JSONPPolling.prototype.doPoll = function () {
  var self = this;
  var script = document.createElement('script');

  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  script.async = true;
  script.src = this.uri();
  script.onerror = function (e) {
    self.onError('jsonp poll error', e);
  };

  var insertAt = document.getElementsByTagName('script')[0];
  if (insertAt) {
    insertAt.parentNode.insertBefore(script, insertAt);
  } else {
    (document.head || document.body).appendChild(script);
  }
  this.script = script;

  var isUAgecko = 'undefined' !== typeof navigator && /gecko/i.test(navigator.userAgent);

  if (isUAgecko) {
    setTimeout(function () {
      var iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      document.body.removeChild(iframe);
    }, 100);
  }
};

/**
 * Writes with a hidden iframe.
 *
 * @param {String} data to send
 * @param {Function} called upon flush.
 * @api private
 */

JSONPPolling.prototype.doWrite = function (data, fn) {
  var self = this;

  if (!this.form) {
    var form = document.createElement('form');
    var area = document.createElement('textarea');
    var id = this.iframeId = 'eio_iframe_' + this.index;
    var iframe;

    form.className = 'socketio';
    form.style.position = 'absolute';
    form.style.top = '-1000px';
    form.style.left = '-1000px';
    form.target = id;
    form.method = 'POST';
    form.setAttribute('accept-charset', 'utf-8');
    area.name = 'd';
    form.appendChild(area);
    document.body.appendChild(form);

    this.form = form;
    this.area = area;
  }

  this.form.action = this.uri();

  function complete () {
    initIframe();
    fn();
  }

  function initIframe () {
    if (self.iframe) {
      try {
        self.form.removeChild(self.iframe);
      } catch (e) {
        self.onError('jsonp polling iframe removal error', e);
      }
    }

    try {
      // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
      var html = '<iframe src="javascript:0" name="' + self.iframeId + '">';
      iframe = document.createElement(html);
    } catch (e) {
      iframe = document.createElement('iframe');
      iframe.name = self.iframeId;
      iframe.src = 'javascript:0';
    }

    iframe.id = self.iframeId;

    self.form.appendChild(iframe);
    self.iframe = iframe;
  }

  initIframe();

  // escape \n to prevent it from being converted into \r\n by some UAs
  // double escaping is required for escaped new lines because unescaping of new lines can be done safely on server-side
  data = data.replace(rEscapedNewline, '\\\n');
  this.area.value = data.replace(rNewline, '\\n');

  try {
    this.form.submit();
  } catch (e) {}

  if (this.iframe.attachEvent) {
    this.iframe.onreadystatechange = function () {
      if (self.iframe.readyState === 'complete') {
        complete();
      }
    };
  } else {
    this.iframe.onload = complete;
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling":51,"component-inherit":35}],50:[function(require,module,exports){
(function (global){
/**
 * Module requirements.
 */

var XMLHttpRequest = require('xmlhttprequest-ssl');
var Polling = require('./polling');
var Emitter = require('component-emitter');
var inherit = require('component-inherit');
var debug = require('debug')('engine.io-client:polling-xhr');

/**
 * Module exports.
 */

module.exports = XHR;
module.exports.Request = Request;

/**
 * Empty function
 */

function empty () {}

/**
 * XHR Polling constructor.
 *
 * @param {Object} opts
 * @api public
 */

function XHR (opts) {
  Polling.call(this, opts);
  this.requestTimeout = opts.requestTimeout;
  this.extraHeaders = opts.extraHeaders;

  if (global.location) {
    var isSSL = 'https:' === location.protocol;
    var port = location.port;

    // some user agents have empty `location.port`
    if (!port) {
      port = isSSL ? 443 : 80;
    }

    this.xd = opts.hostname !== global.location.hostname ||
      port !== opts.port;
    this.xs = opts.secure !== isSSL;
  }
}

/**
 * Inherits from Polling.
 */

inherit(XHR, Polling);

/**
 * XHR supports binary
 */

XHR.prototype.supportsBinary = true;

/**
 * Creates a request.
 *
 * @param {String} method
 * @api private
 */

XHR.prototype.request = function (opts) {
  opts = opts || {};
  opts.uri = this.uri();
  opts.xd = this.xd;
  opts.xs = this.xs;
  opts.agent = this.agent || false;
  opts.supportsBinary = this.supportsBinary;
  opts.enablesXDR = this.enablesXDR;

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;
  opts.requestTimeout = this.requestTimeout;

  // other options for Node.js client
  opts.extraHeaders = this.extraHeaders;

  return new Request(opts);
};

/**
 * Sends data.
 *
 * @param {String} data to send.
 * @param {Function} called upon flush.
 * @api private
 */

XHR.prototype.doWrite = function (data, fn) {
  var isBinary = typeof data !== 'string' && data !== undefined;
  var req = this.request({ method: 'POST', data: data, isBinary: isBinary });
  var self = this;
  req.on('success', fn);
  req.on('error', function (err) {
    self.onError('xhr post error', err);
  });
  this.sendXhr = req;
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

XHR.prototype.doPoll = function () {
  debug('xhr poll');
  var req = this.request();
  var self = this;
  req.on('data', function (data) {
    self.onData(data);
  });
  req.on('error', function (err) {
    self.onError('xhr poll error', err);
  });
  this.pollXhr = req;
};

/**
 * Request constructor
 *
 * @param {Object} options
 * @api public
 */

function Request (opts) {
  this.method = opts.method || 'GET';
  this.uri = opts.uri;
  this.xd = !!opts.xd;
  this.xs = !!opts.xs;
  this.async = false !== opts.async;
  this.data = undefined !== opts.data ? opts.data : null;
  this.agent = opts.agent;
  this.isBinary = opts.isBinary;
  this.supportsBinary = opts.supportsBinary;
  this.enablesXDR = opts.enablesXDR;
  this.requestTimeout = opts.requestTimeout;

  // SSL options for Node.js client
  this.pfx = opts.pfx;
  this.key = opts.key;
  this.passphrase = opts.passphrase;
  this.cert = opts.cert;
  this.ca = opts.ca;
  this.ciphers = opts.ciphers;
  this.rejectUnauthorized = opts.rejectUnauthorized;

  // other options for Node.js client
  this.extraHeaders = opts.extraHeaders;

  this.create();
}

/**
 * Mix in `Emitter`.
 */

Emitter(Request.prototype);

/**
 * Creates the XHR object and sends the request.
 *
 * @api private
 */

Request.prototype.create = function () {
  var opts = { agent: this.agent, xdomain: this.xd, xscheme: this.xs, enablesXDR: this.enablesXDR };

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;

  var xhr = this.xhr = new XMLHttpRequest(opts);
  var self = this;

  try {
    debug('xhr open %s: %s', this.method, this.uri);
    xhr.open(this.method, this.uri, this.async);
    try {
      if (this.extraHeaders) {
        xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
        for (var i in this.extraHeaders) {
          if (this.extraHeaders.hasOwnProperty(i)) {
            xhr.setRequestHeader(i, this.extraHeaders[i]);
          }
        }
      }
    } catch (e) {}

    if ('POST' === this.method) {
      try {
        if (this.isBinary) {
          xhr.setRequestHeader('Content-type', 'application/octet-stream');
        } else {
          xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
        }
      } catch (e) {}
    }

    try {
      xhr.setRequestHeader('Accept', '*/*');
    } catch (e) {}

    // ie6 check
    if ('withCredentials' in xhr) {
      xhr.withCredentials = true;
    }

    if (this.requestTimeout) {
      xhr.timeout = this.requestTimeout;
    }

    if (this.hasXDR()) {
      xhr.onload = function () {
        self.onLoad();
      };
      xhr.onerror = function () {
        self.onError(xhr.responseText);
      };
    } else {
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 2) {
          try {
            var contentType = xhr.getResponseHeader('Content-Type');
            if (self.supportsBinary && contentType === 'application/octet-stream') {
              xhr.responseType = 'arraybuffer';
            }
          } catch (e) {}
        }
        if (4 !== xhr.readyState) return;
        if (200 === xhr.status || 1223 === xhr.status) {
          self.onLoad();
        } else {
          // make sure the `error` event handler that's user-set
          // does not throw in the same tick and gets caught here
          setTimeout(function () {
            self.onError(xhr.status);
          }, 0);
        }
      };
    }

    debug('xhr data %s', this.data);
    xhr.send(this.data);
  } catch (e) {
    // Need to defer since .create() is called directly fhrom the constructor
    // and thus the 'error' event can only be only bound *after* this exception
    // occurs.  Therefore, also, we cannot throw here at all.
    setTimeout(function () {
      self.onError(e);
    }, 0);
    return;
  }

  if (global.document) {
    this.index = Request.requestsCount++;
    Request.requests[this.index] = this;
  }
};

/**
 * Called upon successful response.
 *
 * @api private
 */

Request.prototype.onSuccess = function () {
  this.emit('success');
  this.cleanup();
};

/**
 * Called if we have data.
 *
 * @api private
 */

Request.prototype.onData = function (data) {
  this.emit('data', data);
  this.onSuccess();
};

/**
 * Called upon error.
 *
 * @api private
 */

Request.prototype.onError = function (err) {
  this.emit('error', err);
  this.cleanup(true);
};

/**
 * Cleans up house.
 *
 * @api private
 */

Request.prototype.cleanup = function (fromError) {
  if ('undefined' === typeof this.xhr || null === this.xhr) {
    return;
  }
  // xmlhttprequest
  if (this.hasXDR()) {
    this.xhr.onload = this.xhr.onerror = empty;
  } else {
    this.xhr.onreadystatechange = empty;
  }

  if (fromError) {
    try {
      this.xhr.abort();
    } catch (e) {}
  }

  if (global.document) {
    delete Request.requests[this.index];
  }

  this.xhr = null;
};

/**
 * Called upon load.
 *
 * @api private
 */

Request.prototype.onLoad = function () {
  var data;
  try {
    var contentType;
    try {
      contentType = this.xhr.getResponseHeader('Content-Type');
    } catch (e) {}
    if (contentType === 'application/octet-stream') {
      data = this.xhr.response || this.xhr.responseText;
    } else {
      data = this.xhr.responseText;
    }
  } catch (e) {
    this.onError(e);
  }
  if (null != data) {
    this.onData(data);
  }
};

/**
 * Check if it has XDomainRequest.
 *
 * @api private
 */

Request.prototype.hasXDR = function () {
  return 'undefined' !== typeof global.XDomainRequest && !this.xs && this.enablesXDR;
};

/**
 * Aborts the request.
 *
 * @api public
 */

Request.prototype.abort = function () {
  this.cleanup();
};

/**
 * Aborts pending requests when unloading the window. This is needed to prevent
 * memory leaks (e.g. when using IE) and to ensure that no spurious error is
 * emitted.
 */

Request.requestsCount = 0;
Request.requests = {};

if (global.document) {
  if (global.attachEvent) {
    global.attachEvent('onunload', unloadHandler);
  } else if (global.addEventListener) {
    global.addEventListener('beforeunload', unloadHandler, false);
  }
}

function unloadHandler () {
  for (var i in Request.requests) {
    if (Request.requests.hasOwnProperty(i)) {
      Request.requests[i].abort();
    }
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling":51,"component-emitter":34,"component-inherit":35,"debug":54,"xmlhttprequest-ssl":53}],51:[function(require,module,exports){
/**
 * Module dependencies.
 */

var Transport = require('../transport');
var parseqs = require('parseqs');
var parser = require('engine.io-parser');
var inherit = require('component-inherit');
var yeast = require('yeast');
var debug = require('debug')('engine.io-client:polling');

/**
 * Module exports.
 */

module.exports = Polling;

/**
 * Is XHR2 supported?
 */

var hasXHR2 = (function () {
  var XMLHttpRequest = require('xmlhttprequest-ssl');
  var xhr = new XMLHttpRequest({ xdomain: false });
  return null != xhr.responseType;
})();

/**
 * Polling interface.
 *
 * @param {Object} opts
 * @api private
 */

function Polling (opts) {
  var forceBase64 = (opts && opts.forceBase64);
  if (!hasXHR2 || forceBase64) {
    this.supportsBinary = false;
  }
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

inherit(Polling, Transport);

/**
 * Transport name.
 */

Polling.prototype.name = 'polling';

/**
 * Opens the socket (triggers polling). We write a PING message to determine
 * when the transport is open.
 *
 * @api private
 */

Polling.prototype.doOpen = function () {
  this.poll();
};

/**
 * Pauses polling.
 *
 * @param {Function} callback upon buffers are flushed and transport is paused
 * @api private
 */

Polling.prototype.pause = function (onPause) {
  var self = this;

  this.readyState = 'pausing';

  function pause () {
    debug('paused');
    self.readyState = 'paused';
    onPause();
  }

  if (this.polling || !this.writable) {
    var total = 0;

    if (this.polling) {
      debug('we are currently polling - waiting to pause');
      total++;
      this.once('pollComplete', function () {
        debug('pre-pause polling complete');
        --total || pause();
      });
    }

    if (!this.writable) {
      debug('we are currently writing - waiting to pause');
      total++;
      this.once('drain', function () {
        debug('pre-pause writing complete');
        --total || pause();
      });
    }
  } else {
    pause();
  }
};

/**
 * Starts polling cycle.
 *
 * @api public
 */

Polling.prototype.poll = function () {
  debug('polling');
  this.polling = true;
  this.doPoll();
  this.emit('poll');
};

/**
 * Overloads onData to detect payloads.
 *
 * @api private
 */

Polling.prototype.onData = function (data) {
  var self = this;
  debug('polling got data %s', data);
  var callback = function (packet, index, total) {
    // if its the first message we consider the transport open
    if ('opening' === self.readyState) {
      self.onOpen();
    }

    // if its a close packet, we close the ongoing requests
    if ('close' === packet.type) {
      self.onClose();
      return false;
    }

    // otherwise bypass onData and handle the message
    self.onPacket(packet);
  };

  // decode payload
  parser.decodePayload(data, this.socket.binaryType, callback);

  // if an event did not trigger closing
  if ('closed' !== this.readyState) {
    // if we got data we're not polling
    this.polling = false;
    this.emit('pollComplete');

    if ('open' === this.readyState) {
      this.poll();
    } else {
      debug('ignoring poll - transport state "%s"', this.readyState);
    }
  }
};

/**
 * For polling, send a close packet.
 *
 * @api private
 */

Polling.prototype.doClose = function () {
  var self = this;

  function close () {
    debug('writing close packet');
    self.write([{ type: 'close' }]);
  }

  if ('open' === this.readyState) {
    debug('transport open - closing');
    close();
  } else {
    // in case we're trying to close while
    // handshaking is in progress (GH-164)
    debug('transport not open - deferring close');
    this.once('open', close);
  }
};

/**
 * Writes a packets payload.
 *
 * @param {Array} data packets
 * @param {Function} drain callback
 * @api private
 */

Polling.prototype.write = function (packets) {
  var self = this;
  this.writable = false;
  var callbackfn = function () {
    self.writable = true;
    self.emit('drain');
  };

  parser.encodePayload(packets, this.supportsBinary, function (data) {
    self.doWrite(data, callbackfn);
  });
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

Polling.prototype.uri = function () {
  var query = this.query || {};
  var schema = this.secure ? 'https' : 'http';
  var port = '';

  // cache busting is forced
  if (false !== this.timestampRequests) {
    query[this.timestampParam] = yeast();
  }

  if (!this.supportsBinary && !query.sid) {
    query.b64 = 1;
  }

  query = parseqs.encode(query);

  // avoid port if default for schema
  if (this.port && (('https' === schema && Number(this.port) !== 443) ||
     ('http' === schema && Number(this.port) !== 80))) {
    port = ':' + this.port;
  }

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  var ipv6 = this.hostname.indexOf(':') !== -1;
  return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
};

},{"../transport":47,"component-inherit":35,"debug":54,"engine.io-parser":56,"parseqs":68,"xmlhttprequest-ssl":53,"yeast":85}],52:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var Transport = require('../transport');
var parser = require('engine.io-parser');
var parseqs = require('parseqs');
var inherit = require('component-inherit');
var yeast = require('yeast');
var debug = require('debug')('engine.io-client:websocket');
var BrowserWebSocket = global.WebSocket || global.MozWebSocket;
var NodeWebSocket;
if (typeof window === 'undefined') {
  try {
    NodeWebSocket = require('ws');
  } catch (e) { }
}

/**
 * Get either the `WebSocket` or `MozWebSocket` globals
 * in the browser or try to resolve WebSocket-compatible
 * interface exposed by `ws` for Node-like environment.
 */

var WebSocket = BrowserWebSocket;
if (!WebSocket && typeof window === 'undefined') {
  WebSocket = NodeWebSocket;
}

/**
 * Module exports.
 */

module.exports = WS;

/**
 * WebSocket transport constructor.
 *
 * @api {Object} connection options
 * @api public
 */

function WS (opts) {
  var forceBase64 = (opts && opts.forceBase64);
  if (forceBase64) {
    this.supportsBinary = false;
  }
  this.perMessageDeflate = opts.perMessageDeflate;
  this.usingBrowserWebSocket = BrowserWebSocket && !opts.forceNode;
  this.protocols = opts.protocols;
  if (!this.usingBrowserWebSocket) {
    WebSocket = NodeWebSocket;
  }
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

inherit(WS, Transport);

/**
 * Transport name.
 *
 * @api public
 */

WS.prototype.name = 'websocket';

/*
 * WebSockets support binary
 */

WS.prototype.supportsBinary = true;

/**
 * Opens socket.
 *
 * @api private
 */

WS.prototype.doOpen = function () {
  if (!this.check()) {
    // let probe timeout
    return;
  }

  var uri = this.uri();
  var protocols = this.protocols;
  var opts = {
    agent: this.agent,
    perMessageDeflate: this.perMessageDeflate
  };

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;
  if (this.extraHeaders) {
    opts.headers = this.extraHeaders;
  }
  if (this.localAddress) {
    opts.localAddress = this.localAddress;
  }

  try {
    this.ws = this.usingBrowserWebSocket ? (protocols ? new WebSocket(uri, protocols) : new WebSocket(uri)) : new WebSocket(uri, protocols, opts);
  } catch (err) {
    return this.emit('error', err);
  }

  if (this.ws.binaryType === undefined) {
    this.supportsBinary = false;
  }

  if (this.ws.supports && this.ws.supports.binary) {
    this.supportsBinary = true;
    this.ws.binaryType = 'nodebuffer';
  } else {
    this.ws.binaryType = 'arraybuffer';
  }

  this.addEventListeners();
};

/**
 * Adds event listeners to the socket
 *
 * @api private
 */

WS.prototype.addEventListeners = function () {
  var self = this;

  this.ws.onopen = function () {
    self.onOpen();
  };
  this.ws.onclose = function () {
    self.onClose();
  };
  this.ws.onmessage = function (ev) {
    self.onData(ev.data);
  };
  this.ws.onerror = function (e) {
    self.onError('websocket error', e);
  };
};

/**
 * Writes data to socket.
 *
 * @param {Array} array of packets.
 * @api private
 */

WS.prototype.write = function (packets) {
  var self = this;
  this.writable = false;

  // encodePacket efficient as it uses WS framing
  // no need for encodePayload
  var total = packets.length;
  for (var i = 0, l = total; i < l; i++) {
    (function (packet) {
      parser.encodePacket(packet, self.supportsBinary, function (data) {
        if (!self.usingBrowserWebSocket) {
          // always create a new object (GH-437)
          var opts = {};
          if (packet.options) {
            opts.compress = packet.options.compress;
          }

          if (self.perMessageDeflate) {
            var len = 'string' === typeof data ? global.Buffer.byteLength(data) : data.length;
            if (len < self.perMessageDeflate.threshold) {
              opts.compress = false;
            }
          }
        }

        // Sometimes the websocket has already been closed but the browser didn't
        // have a chance of informing us about it yet, in that case send will
        // throw an error
        try {
          if (self.usingBrowserWebSocket) {
            // TypeError is thrown when passing the second argument on Safari
            self.ws.send(data);
          } else {
            self.ws.send(data, opts);
          }
        } catch (e) {
          debug('websocket closed before onclose event');
        }

        --total || done();
      });
    })(packets[i]);
  }

  function done () {
    self.emit('flush');

    // fake drain
    // defer to next tick to allow Socket to clear writeBuffer
    setTimeout(function () {
      self.writable = true;
      self.emit('drain');
    }, 0);
  }
};

/**
 * Called upon close
 *
 * @api private
 */

WS.prototype.onClose = function () {
  Transport.prototype.onClose.call(this);
};

/**
 * Closes socket.
 *
 * @api private
 */

WS.prototype.doClose = function () {
  if (typeof this.ws !== 'undefined') {
    this.ws.close();
  }
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

WS.prototype.uri = function () {
  var query = this.query || {};
  var schema = this.secure ? 'wss' : 'ws';
  var port = '';

  // avoid port if default for schema
  if (this.port && (('wss' === schema && Number(this.port) !== 443) ||
    ('ws' === schema && Number(this.port) !== 80))) {
    port = ':' + this.port;
  }

  // append timestamp to URI
  if (this.timestampRequests) {
    query[this.timestampParam] = yeast();
  }

  // communicate binary support capabilities
  if (!this.supportsBinary) {
    query.b64 = 1;
  }

  query = parseqs.encode(query);

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  var ipv6 = this.hostname.indexOf(':') !== -1;
  return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
};

/**
 * Feature detection for WebSocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

WS.prototype.check = function () {
  return !!WebSocket && !('__initialize' in WebSocket && this.name === WS.prototype.name);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../transport":47,"component-inherit":35,"debug":54,"engine.io-parser":56,"parseqs":68,"ws":2,"yeast":85}],53:[function(require,module,exports){
(function (global){
// browser shim for xmlhttprequest module

var hasCORS = require('has-cors');

module.exports = function (opts) {
  var xdomain = opts.xdomain;

  // scheme must be same when usign XDomainRequest
  // http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
  var xscheme = opts.xscheme;

  // XDomainRequest has a flow of not sending cookie, therefore it should be disabled as a default.
  // https://github.com/Automattic/engine.io-client/pull/217
  var enablesXDR = opts.enablesXDR;

  // XMLHttpRequest can be disabled on IE
  try {
    if ('undefined' !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
      return new XMLHttpRequest();
    }
  } catch (e) { }

  // Use XDomainRequest for IE8 if enablesXDR is true
  // because loading bar keeps flashing when using jsonp-polling
  // https://github.com/yujiosaka/socke.io-ie8-loading-example
  try {
    if ('undefined' !== typeof XDomainRequest && !xscheme && enablesXDR) {
      return new XDomainRequest();
    }
  } catch (e) { }

  if (!xdomain) {
    try {
      return new global[['Active'].concat('Object').join('X')]('Microsoft.XMLHTTP');
    } catch (e) { }
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"has-cors":61}],54:[function(require,module,exports){
(function (process){
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
  '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
  '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
  '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
  '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
  '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
  '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
  '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
  '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
  '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
  '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // Internet Explorer and Edge do not support colors.
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
    return false;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}

}).call(this,require('_process'))
},{"./debug":55,"_process":7}],55:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * Active `debug` instances.
 */
exports.instances = [];

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  var prevTime;

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);
  debug.destroy = destroy;

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  exports.instances.push(debug);

  return debug;
}

function destroy () {
  var index = exports.instances.indexOf(this);
  if (index !== -1) {
    exports.instances.splice(index, 1);
    return true;
  } else {
    return false;
  }
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var i;
  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }

  for (i = 0; i < exports.instances.length; i++) {
    var instance = exports.instances[i];
    instance.enabled = exports.enabled(instance.namespace);
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  if (name[name.length - 1] === '*') {
    return true;
  }
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":64}],56:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var keys = require('./keys');
var hasBinary = require('has-binary2');
var sliceBuffer = require('arraybuffer.slice');
var after = require('after');
var utf8 = require('./utf8');

var base64encoder;
if (global && global.ArrayBuffer) {
  base64encoder = require('base64-arraybuffer');
}

/**
 * Check if we are running an android browser. That requires us to use
 * ArrayBuffer with polling transports...
 *
 * http://ghinda.net/jpeg-blob-ajax-android/
 */

var isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

/**
 * Check if we are running in PhantomJS.
 * Uploading a Blob with PhantomJS does not work correctly, as reported here:
 * https://github.com/ariya/phantomjs/issues/11395
 * @type boolean
 */
var isPhantomJS = typeof navigator !== 'undefined' && /PhantomJS/i.test(navigator.userAgent);

/**
 * When true, avoids using Blobs to encode payloads.
 * @type boolean
 */
var dontSendBlobs = isAndroid || isPhantomJS;

/**
 * Current protocol version.
 */

exports.protocol = 3;

/**
 * Packet types.
 */

var packets = exports.packets = {
    open:     0    // non-ws
  , close:    1    // non-ws
  , ping:     2
  , pong:     3
  , message:  4
  , upgrade:  5
  , noop:     6
};

var packetslist = keys(packets);

/**
 * Premade error packet.
 */

var err = { type: 'error', data: 'parser error' };

/**
 * Create a blob api even for blob builder when vendor prefixes exist
 */

var Blob = require('blob');

/**
 * Encodes a packet.
 *
 *     <packet type id> [ <data> ]
 *
 * Example:
 *
 *     5hello world
 *     3
 *     4
 *
 * Binary is encoded in an identical principle
 *
 * @api private
 */

exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
  if (typeof supportsBinary === 'function') {
    callback = supportsBinary;
    supportsBinary = false;
  }

  if (typeof utf8encode === 'function') {
    callback = utf8encode;
    utf8encode = null;
  }

  var data = (packet.data === undefined)
    ? undefined
    : packet.data.buffer || packet.data;

  if (global.ArrayBuffer && data instanceof ArrayBuffer) {
    return encodeArrayBuffer(packet, supportsBinary, callback);
  } else if (Blob && data instanceof global.Blob) {
    return encodeBlob(packet, supportsBinary, callback);
  }

  // might be an object with { base64: true, data: dataAsBase64String }
  if (data && data.base64) {
    return encodeBase64Object(packet, callback);
  }

  // Sending data as a utf-8 string
  var encoded = packets[packet.type];

  // data fragment is optional
  if (undefined !== packet.data) {
    encoded += utf8encode ? utf8.encode(String(packet.data), { strict: false }) : String(packet.data);
  }

  return callback('' + encoded);

};

function encodeBase64Object(packet, callback) {
  // packet data is an object { base64: true, data: dataAsBase64String }
  var message = 'b' + exports.packets[packet.type] + packet.data.data;
  return callback(message);
}

/**
 * Encode packet helpers for binary types
 */

function encodeArrayBuffer(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  var data = packet.data;
  var contentArray = new Uint8Array(data);
  var resultBuffer = new Uint8Array(1 + data.byteLength);

  resultBuffer[0] = packets[packet.type];
  for (var i = 0; i < contentArray.length; i++) {
    resultBuffer[i+1] = contentArray[i];
  }

  return callback(resultBuffer.buffer);
}

function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  var fr = new FileReader();
  fr.onload = function() {
    packet.data = fr.result;
    exports.encodePacket(packet, supportsBinary, true, callback);
  };
  return fr.readAsArrayBuffer(packet.data);
}

function encodeBlob(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  if (dontSendBlobs) {
    return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
  }

  var length = new Uint8Array(1);
  length[0] = packets[packet.type];
  var blob = new Blob([length.buffer, packet.data]);

  return callback(blob);
}

/**
 * Encodes a packet with binary data in a base64 string
 *
 * @param {Object} packet, has `type` and `data`
 * @return {String} base64 encoded message
 */

exports.encodeBase64Packet = function(packet, callback) {
  var message = 'b' + exports.packets[packet.type];
  if (Blob && packet.data instanceof global.Blob) {
    var fr = new FileReader();
    fr.onload = function() {
      var b64 = fr.result.split(',')[1];
      callback(message + b64);
    };
    return fr.readAsDataURL(packet.data);
  }

  var b64data;
  try {
    b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
  } catch (e) {
    // iPhone Safari doesn't let you apply with typed arrays
    var typed = new Uint8Array(packet.data);
    var basic = new Array(typed.length);
    for (var i = 0; i < typed.length; i++) {
      basic[i] = typed[i];
    }
    b64data = String.fromCharCode.apply(null, basic);
  }
  message += global.btoa(b64data);
  return callback(message);
};

/**
 * Decodes a packet. Changes format to Blob if requested.
 *
 * @return {Object} with `type` and `data` (if any)
 * @api private
 */

exports.decodePacket = function (data, binaryType, utf8decode) {
  if (data === undefined) {
    return err;
  }
  // String data
  if (typeof data === 'string') {
    if (data.charAt(0) === 'b') {
      return exports.decodeBase64Packet(data.substr(1), binaryType);
    }

    if (utf8decode) {
      data = tryDecode(data);
      if (data === false) {
        return err;
      }
    }
    var type = data.charAt(0);

    if (Number(type) != type || !packetslist[type]) {
      return err;
    }

    if (data.length > 1) {
      return { type: packetslist[type], data: data.substring(1) };
    } else {
      return { type: packetslist[type] };
    }
  }

  var asArray = new Uint8Array(data);
  var type = asArray[0];
  var rest = sliceBuffer(data, 1);
  if (Blob && binaryType === 'blob') {
    rest = new Blob([rest]);
  }
  return { type: packetslist[type], data: rest };
};

function tryDecode(data) {
  try {
    data = utf8.decode(data, { strict: false });
  } catch (e) {
    return false;
  }
  return data;
}

/**
 * Decodes a packet encoded in a base64 string
 *
 * @param {String} base64 encoded message
 * @return {Object} with `type` and `data` (if any)
 */

exports.decodeBase64Packet = function(msg, binaryType) {
  var type = packetslist[msg.charAt(0)];
  if (!base64encoder) {
    return { type: type, data: { base64: true, data: msg.substr(1) } };
  }

  var data = base64encoder.decode(msg.substr(1));

  if (binaryType === 'blob' && Blob) {
    data = new Blob([data]);
  }

  return { type: type, data: data };
};

/**
 * Encodes multiple messages (payload).
 *
 *     <length>:data
 *
 * Example:
 *
 *     11:hello world2:hi
 *
 * If any contents are binary, they will be encoded as base64 strings. Base64
 * encoded strings are marked with a b before the length specifier
 *
 * @param {Array} packets
 * @api private
 */

exports.encodePayload = function (packets, supportsBinary, callback) {
  if (typeof supportsBinary === 'function') {
    callback = supportsBinary;
    supportsBinary = null;
  }

  var isBinary = hasBinary(packets);

  if (supportsBinary && isBinary) {
    if (Blob && !dontSendBlobs) {
      return exports.encodePayloadAsBlob(packets, callback);
    }

    return exports.encodePayloadAsArrayBuffer(packets, callback);
  }

  if (!packets.length) {
    return callback('0:');
  }

  function setLengthHeader(message) {
    return message.length + ':' + message;
  }

  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, !isBinary ? false : supportsBinary, false, function(message) {
      doneCallback(null, setLengthHeader(message));
    });
  }

  map(packets, encodeOne, function(err, results) {
    return callback(results.join(''));
  });
};

/**
 * Async array map using after
 */

function map(ary, each, done) {
  var result = new Array(ary.length);
  var next = after(ary.length, done);

  var eachWithIndex = function(i, el, cb) {
    each(el, function(error, msg) {
      result[i] = msg;
      cb(error, result);
    });
  };

  for (var i = 0; i < ary.length; i++) {
    eachWithIndex(i, ary[i], next);
  }
}

/*
 * Decodes data when a payload is maybe expected. Possible binary contents are
 * decoded from their base64 representation
 *
 * @param {String} data, callback method
 * @api public
 */

exports.decodePayload = function (data, binaryType, callback) {
  if (typeof data !== 'string') {
    return exports.decodePayloadAsBinary(data, binaryType, callback);
  }

  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var packet;
  if (data === '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

  var length = '', n, msg;

  for (var i = 0, l = data.length; i < l; i++) {
    var chr = data.charAt(i);

    if (chr !== ':') {
      length += chr;
      continue;
    }

    if (length === '' || (length != (n = Number(length)))) {
      // parser error - ignoring payload
      return callback(err, 0, 1);
    }

    msg = data.substr(i + 1, n);

    if (length != msg.length) {
      // parser error - ignoring payload
      return callback(err, 0, 1);
    }

    if (msg.length) {
      packet = exports.decodePacket(msg, binaryType, false);

      if (err.type === packet.type && err.data === packet.data) {
        // parser error in individual packet - ignoring payload
        return callback(err, 0, 1);
      }

      var ret = callback(packet, i + n, l);
      if (false === ret) return;
    }

    // advance cursor
    i += n;
    length = '';
  }

  if (length !== '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

};

/**
 * Encodes multiple messages (payload) as binary.
 *
 * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
 * 255><data>
 *
 * Example:
 * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
 *
 * @param {Array} packets
 * @return {ArrayBuffer} encoded payload
 * @api private
 */

exports.encodePayloadAsArrayBuffer = function(packets, callback) {
  if (!packets.length) {
    return callback(new ArrayBuffer(0));
  }

  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, true, true, function(data) {
      return doneCallback(null, data);
    });
  }

  map(packets, encodeOne, function(err, encodedPackets) {
    var totalLength = encodedPackets.reduce(function(acc, p) {
      var len;
      if (typeof p === 'string'){
        len = p.length;
      } else {
        len = p.byteLength;
      }
      return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
    }, 0);

    var resultArray = new Uint8Array(totalLength);

    var bufferIndex = 0;
    encodedPackets.forEach(function(p) {
      var isString = typeof p === 'string';
      var ab = p;
      if (isString) {
        var view = new Uint8Array(p.length);
        for (var i = 0; i < p.length; i++) {
          view[i] = p.charCodeAt(i);
        }
        ab = view.buffer;
      }

      if (isString) { // not true binary
        resultArray[bufferIndex++] = 0;
      } else { // true binary
        resultArray[bufferIndex++] = 1;
      }

      var lenStr = ab.byteLength.toString();
      for (var i = 0; i < lenStr.length; i++) {
        resultArray[bufferIndex++] = parseInt(lenStr[i]);
      }
      resultArray[bufferIndex++] = 255;

      var view = new Uint8Array(ab);
      for (var i = 0; i < view.length; i++) {
        resultArray[bufferIndex++] = view[i];
      }
    });

    return callback(resultArray.buffer);
  });
};

/**
 * Encode as Blob
 */

exports.encodePayloadAsBlob = function(packets, callback) {
  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, true, true, function(encoded) {
      var binaryIdentifier = new Uint8Array(1);
      binaryIdentifier[0] = 1;
      if (typeof encoded === 'string') {
        var view = new Uint8Array(encoded.length);
        for (var i = 0; i < encoded.length; i++) {
          view[i] = encoded.charCodeAt(i);
        }
        encoded = view.buffer;
        binaryIdentifier[0] = 0;
      }

      var len = (encoded instanceof ArrayBuffer)
        ? encoded.byteLength
        : encoded.size;

      var lenStr = len.toString();
      var lengthAry = new Uint8Array(lenStr.length + 1);
      for (var i = 0; i < lenStr.length; i++) {
        lengthAry[i] = parseInt(lenStr[i]);
      }
      lengthAry[lenStr.length] = 255;

      if (Blob) {
        var blob = new Blob([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
        doneCallback(null, blob);
      }
    });
  }

  map(packets, encodeOne, function(err, results) {
    return callback(new Blob(results));
  });
};

/*
 * Decodes data when a payload is maybe expected. Strings are decoded by
 * interpreting each byte as a key code for entries marked to start with 0. See
 * description of encodePayloadAsBinary
 *
 * @param {ArrayBuffer} data, callback method
 * @api public
 */

exports.decodePayloadAsBinary = function (data, binaryType, callback) {
  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var bufferTail = data;
  var buffers = [];

  while (bufferTail.byteLength > 0) {
    var tailArray = new Uint8Array(bufferTail);
    var isString = tailArray[0] === 0;
    var msgLength = '';

    for (var i = 1; ; i++) {
      if (tailArray[i] === 255) break;

      // 310 = char length of Number.MAX_VALUE
      if (msgLength.length > 310) {
        return callback(err, 0, 1);
      }

      msgLength += tailArray[i];
    }

    bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
    msgLength = parseInt(msgLength);

    var msg = sliceBuffer(bufferTail, 0, msgLength);
    if (isString) {
      try {
        msg = String.fromCharCode.apply(null, new Uint8Array(msg));
      } catch (e) {
        // iPhone Safari doesn't let you apply to typed arrays
        var typed = new Uint8Array(msg);
        msg = '';
        for (var i = 0; i < typed.length; i++) {
          msg += String.fromCharCode(typed[i]);
        }
      }
    }

    buffers.push(msg);
    bufferTail = sliceBuffer(bufferTail, msgLength);
  }

  var total = buffers.length;
  buffers.forEach(function(buffer, i) {
    callback(exports.decodePacket(buffer, binaryType, true), i, total);
  });
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./keys":57,"./utf8":58,"after":28,"arraybuffer.slice":29,"base64-arraybuffer":31,"blob":32,"has-binary2":59}],57:[function(require,module,exports){

/**
 * Gets the keys for an object.
 *
 * @return {Array} keys
 * @api private
 */

module.exports = Object.keys || function keys (obj){
  var arr = [];
  var has = Object.prototype.hasOwnProperty;

  for (var i in obj) {
    if (has.call(obj, i)) {
      arr.push(i);
    }
  }
  return arr;
};

},{}],58:[function(require,module,exports){
(function (global){
/*! https://mths.be/utf8js v2.1.2 by @mathias */
;(function(root) {

	// Detect free variables `exports`
	var freeExports = typeof exports == 'object' && exports;

	// Detect free variable `module`
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js or Browserified code,
	// and use it as `root`
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	var stringFromCharCode = String.fromCharCode;

	// Taken from https://mths.be/punycode
	function ucs2decode(string) {
		var output = [];
		var counter = 0;
		var length = string.length;
		var value;
		var extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	// Taken from https://mths.be/punycode
	function ucs2encode(array) {
		var length = array.length;
		var index = -1;
		var value;
		var output = '';
		while (++index < length) {
			value = array[index];
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
		}
		return output;
	}

	function checkScalarValue(codePoint, strict) {
		if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
			if (strict) {
				throw Error(
					'Lone surrogate U+' + codePoint.toString(16).toUpperCase() +
					' is not a scalar value'
				);
			}
			return false;
		}
		return true;
	}
	/*--------------------------------------------------------------------------*/

	function createByte(codePoint, shift) {
		return stringFromCharCode(((codePoint >> shift) & 0x3F) | 0x80);
	}

	function encodeCodePoint(codePoint, strict) {
		if ((codePoint & 0xFFFFFF80) == 0) { // 1-byte sequence
			return stringFromCharCode(codePoint);
		}
		var symbol = '';
		if ((codePoint & 0xFFFFF800) == 0) { // 2-byte sequence
			symbol = stringFromCharCode(((codePoint >> 6) & 0x1F) | 0xC0);
		}
		else if ((codePoint & 0xFFFF0000) == 0) { // 3-byte sequence
			if (!checkScalarValue(codePoint, strict)) {
				codePoint = 0xFFFD;
			}
			symbol = stringFromCharCode(((codePoint >> 12) & 0x0F) | 0xE0);
			symbol += createByte(codePoint, 6);
		}
		else if ((codePoint & 0xFFE00000) == 0) { // 4-byte sequence
			symbol = stringFromCharCode(((codePoint >> 18) & 0x07) | 0xF0);
			symbol += createByte(codePoint, 12);
			symbol += createByte(codePoint, 6);
		}
		symbol += stringFromCharCode((codePoint & 0x3F) | 0x80);
		return symbol;
	}

	function utf8encode(string, opts) {
		opts = opts || {};
		var strict = false !== opts.strict;

		var codePoints = ucs2decode(string);
		var length = codePoints.length;
		var index = -1;
		var codePoint;
		var byteString = '';
		while (++index < length) {
			codePoint = codePoints[index];
			byteString += encodeCodePoint(codePoint, strict);
		}
		return byteString;
	}

	/*--------------------------------------------------------------------------*/

	function readContinuationByte() {
		if (byteIndex >= byteCount) {
			throw Error('Invalid byte index');
		}

		var continuationByte = byteArray[byteIndex] & 0xFF;
		byteIndex++;

		if ((continuationByte & 0xC0) == 0x80) {
			return continuationByte & 0x3F;
		}

		// If we end up here, it’s not a continuation byte
		throw Error('Invalid continuation byte');
	}

	function decodeSymbol(strict) {
		var byte1;
		var byte2;
		var byte3;
		var byte4;
		var codePoint;

		if (byteIndex > byteCount) {
			throw Error('Invalid byte index');
		}

		if (byteIndex == byteCount) {
			return false;
		}

		// Read first byte
		byte1 = byteArray[byteIndex] & 0xFF;
		byteIndex++;

		// 1-byte sequence (no continuation bytes)
		if ((byte1 & 0x80) == 0) {
			return byte1;
		}

		// 2-byte sequence
		if ((byte1 & 0xE0) == 0xC0) {
			byte2 = readContinuationByte();
			codePoint = ((byte1 & 0x1F) << 6) | byte2;
			if (codePoint >= 0x80) {
				return codePoint;
			} else {
				throw Error('Invalid continuation byte');
			}
		}

		// 3-byte sequence (may include unpaired surrogates)
		if ((byte1 & 0xF0) == 0xE0) {
			byte2 = readContinuationByte();
			byte3 = readContinuationByte();
			codePoint = ((byte1 & 0x0F) << 12) | (byte2 << 6) | byte3;
			if (codePoint >= 0x0800) {
				return checkScalarValue(codePoint, strict) ? codePoint : 0xFFFD;
			} else {
				throw Error('Invalid continuation byte');
			}
		}

		// 4-byte sequence
		if ((byte1 & 0xF8) == 0xF0) {
			byte2 = readContinuationByte();
			byte3 = readContinuationByte();
			byte4 = readContinuationByte();
			codePoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0C) |
				(byte3 << 0x06) | byte4;
			if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
				return codePoint;
			}
		}

		throw Error('Invalid UTF-8 detected');
	}

	var byteArray;
	var byteCount;
	var byteIndex;
	function utf8decode(byteString, opts) {
		opts = opts || {};
		var strict = false !== opts.strict;

		byteArray = ucs2decode(byteString);
		byteCount = byteArray.length;
		byteIndex = 0;
		var codePoints = [];
		var tmp;
		while ((tmp = decodeSymbol(strict)) !== false) {
			codePoints.push(tmp);
		}
		return ucs2encode(codePoints);
	}

	/*--------------------------------------------------------------------------*/

	var utf8 = {
		'version': '2.1.2',
		'encode': utf8encode,
		'decode': utf8decode
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define(function() {
			return utf8;
		});
	}	else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = utf8;
		} else { // in Narwhal or RingoJS v0.7.0-
			var object = {};
			var hasOwnProperty = object.hasOwnProperty;
			for (var key in utf8) {
				hasOwnProperty.call(utf8, key) && (freeExports[key] = utf8[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.utf8 = utf8;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],59:[function(require,module,exports){
(function (Buffer){
/* global Blob File */

/*
 * Module requirements.
 */

var isArray = require('isarray');

var toString = Object.prototype.toString;
var withNativeBlob = typeof Blob === 'function' ||
                        typeof Blob !== 'undefined' && toString.call(Blob) === '[object BlobConstructor]';
var withNativeFile = typeof File === 'function' ||
                        typeof File !== 'undefined' && toString.call(File) === '[object FileConstructor]';

/**
 * Module exports.
 */

module.exports = hasBinary;

/**
 * Checks for binary data.
 *
 * Supports Buffer, ArrayBuffer, Blob and File.
 *
 * @param {Object} anything
 * @api public
 */

function hasBinary (obj) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  if (isArray(obj)) {
    for (var i = 0, l = obj.length; i < l; i++) {
      if (hasBinary(obj[i])) {
        return true;
      }
    }
    return false;
  }

  if ((typeof Buffer === 'function' && Buffer.isBuffer && Buffer.isBuffer(obj)) ||
    (typeof ArrayBuffer === 'function' && obj instanceof ArrayBuffer) ||
    (withNativeBlob && obj instanceof Blob) ||
    (withNativeFile && obj instanceof File)
  ) {
    return true;
  }

  // see: https://github.com/Automattic/has-binary/pull/4
  if (obj.toJSON && typeof obj.toJSON === 'function' && arguments.length === 1) {
    return hasBinary(obj.toJSON(), true);
  }

  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
      return true;
    }
  }

  return false;
}

}).call(this,require("buffer").Buffer)
},{"buffer":3,"isarray":60}],60:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"dup":6}],61:[function(require,module,exports){

/**
 * Module exports.
 *
 * Logic borrowed from Modernizr:
 *
 *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
 */

try {
  module.exports = typeof XMLHttpRequest !== 'undefined' &&
    'withCredentials' in new XMLHttpRequest();
} catch (err) {
  // if XMLHttp support is disabled in IE then it will throw
  // when trying to create
  module.exports = false;
}

},{}],62:[function(require,module,exports){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
},{}],63:[function(require,module,exports){
/*
  Keypress version 2.1.5 (c) 2018 David Mauro.
  Licensed under the Apache License, Version 2.0
  http://www.apache.org/licenses/LICENSE-2.0
*/
(function(){var o,u,x,y,z,r,v,A,E,B,F,G,q,s,p,k,t,C,H,D={}.hasOwnProperty,j=[].indexOf||function(a){for(var c=0,b=this.length;c<b;c++)if(c in this&&this[c]===a)return c;return-1};r={is_unordered:!1,is_counting:!1,is_exclusive:!1,is_solitary:!1,prevent_default:!1,prevent_repeat:!1,normalize_caps_lock:!1};C="meta alt option ctrl shift cmd".split(" ");k="ctrl";o={debug:!1};var w=function(a){var c,b;for(c in a)D.call(a,c)&&(b=a[c],!1!==b&&(this[c]=b));this.keys=this.keys||[];this.count=this.count||0};
w.prototype.allows_key_repeat=function(){return!this.prevent_repeat&&"function"===typeof this.on_keydown};w.prototype.reset=function(){this.count=0;return this.keyup_fired=null};var g=function(a,c){var b,d;"undefined"!==typeof jQuery&&null!==jQuery&&a instanceof jQuery&&(1!==a.length&&p("Warning: your jQuery selector should have exactly one object."),a=a[0]);this.should_force_event_defaults=this.should_suppress_event_defaults=!1;this.sequence_delay=800;this._registered_combos=[];this._keys_down=[];
this._active_combos=[];this._sequence=[];this._sequence_timer=null;this._prevent_capture=!1;this._defaults=c||{};for(b in r)D.call(r,b)&&(d=r[b],this._defaults[b]=this._defaults[b]||d);this.element=a||document.body;b=function(a,b,c){a.addEventListener?a.addEventListener(b,c):a.attachEvent&&a.attachEvent("on"+b,c);return c};var e=this;this.keydown_event=b(this.element,"keydown",function(a){a=a||window.event;e._receive_input(a,true);return e._bug_catcher(a)});var f=this;this.keyup_event=b(this.element,
"keyup",function(a){a=a||window.event;return f._receive_input(a,false)});var h=this;this.blur_event=b(window,"blur",function(){var a,b,c,d;d=h._keys_down;b=0;for(c=d.length;b<c;b++){a=d[b];h._key_up(a,{})}return h._keys_down=[]})};g.prototype.destroy=function(){var a;a=function(a,b,d){if(null!=a.removeEventListener)return a.removeEventListener(b,d);if(null!=a.removeEvent)return a.removeEvent("on"+b,d)};a(this.element,"keydown",this.keydown_event);a(this.element,"keyup",this.keyup_event);return a(window,
"blur",this.blur_event)};g.prototype._bug_catcher=function(a){var c,b;if("cmd"===k&&0<=j.call(this._keys_down,"cmd")&&"cmd"!==(c=y(null!=(b=a.keyCode)?b:a.key))&&"shift"!==c&&"alt"!==c&&"caps"!==c&&"tab"!==c)return this._receive_input(a,!1)};g.prototype._cmd_bug_check=function(a){return"cmd"===k&&0<=j.call(this._keys_down,"cmd")&&0>j.call(a,"cmd")?!1:!0};g.prototype._prevent_default=function(a,c){if((c||this.should_suppress_event_defaults)&&!this.should_force_event_defaults)if(a.preventDefault?a.preventDefault():
a.returnValue=!1,a.stopPropagation)return a.stopPropagation()};g.prototype._get_active_combos=function(a){var c,b;c=[];b=v(this._keys_down,function(b){return b!==a});b.push(a);this._match_combo_arrays(b,function(a){return function(b){if(a._cmd_bug_check(b.keys))return c.push(b)}}(this));this._fuzzy_match_combo_arrays(b,function(a){return function(b){if(!(0<=j.call(c,b))&&!b.is_solitary&&a._cmd_bug_check(b.keys))return c.push(b)}}(this));return c};g.prototype._get_potential_combos=function(a){var c,
b,d,e,f;b=[];f=this._registered_combos;d=0;for(e=f.length;d<e;d++)c=f[d],c.is_sequence||0<=j.call(c.keys,a)&&this._cmd_bug_check(c.keys)&&b.push(c);return b};g.prototype._add_to_active_combos=function(a){var c,b,d,e,f,h,i,g,n,l,m;h=!1;f=!0;d=!1;if(0<=j.call(this._active_combos,a))return!0;if(this._active_combos.length){e=i=0;for(l=this._active_combos.length;0<=l?i<l:i>l;e=0<=l?++i:--i)if((c=this._active_combos[e])&&c.is_exclusive&&a.is_exclusive){c=c.keys;if(!h){g=0;for(n=c.length;g<n;g++)if(b=c[g],
h=!0,0>j.call(a.keys,b)){h=!1;break}}if(f&&!h){m=a.keys;g=0;for(n=m.length;g<n;g++)if(b=m[g],f=!1,0>j.call(c,b)){f=!0;break}}h&&(d?(c=this._active_combos.splice(e,1)[0],null!=c&&c.reset()):(c=this._active_combos.splice(e,1,a)[0],null!=c&&c.reset(),d=!0),f=!1)}}f&&this._active_combos.unshift(a);return h||f};g.prototype._remove_from_active_combos=function(a){var c,b,d,e;b=d=0;for(e=this._active_combos.length;0<=e?d<e:d>e;b=0<=e?++d:--d)if(c=this._active_combos[b],c===a){a=this._active_combos.splice(b,
1)[0];a.reset();break}};g.prototype._get_possible_sequences=function(){var a,c,b,d,e,f,h,i,g,n,l,m;d=[];n=this._registered_combos;f=0;for(g=n.length;f<g;f++){a=n[f];c=h=1;for(l=this._sequence.length;1<=l?h<=l:h>=l;c=1<=l?++h:--h)if(e=this._sequence.slice(-c),a.is_sequence){if(0>j.call(a.keys,"shift")&&(e=v(e,function(a){return"shift"!==a}),!e.length))continue;c=i=0;for(m=e.length;0<=m?i<m:i>m;c=0<=m?++i:--i)if(a.keys[c]===e[c])b=!0;else{b=!1;break}b&&d.push(a)}}return d};g.prototype._add_key_to_sequence=
function(a,c){var b,d,e,f;this._sequence.push(a);d=this._get_possible_sequences();if(d.length){e=0;for(f=d.length;e<f;e++)b=d[e],this._prevent_default(c,b.prevent_default);this._sequence_timer&&clearTimeout(this._sequence_timer);if(-1<this.sequence_delay){var h=this;this._sequence_timer=setTimeout(function(){return h._sequence=[]},this.sequence_delay)}}else this._sequence=[]};g.prototype._get_sequence=function(a){var c,b,d,e,f,h,i,g,n,l,m,k;l=this._registered_combos;h=0;for(n=l.length;h<n;h++)if(c=
l[h],c.is_sequence){b=i=1;for(m=this._sequence.length;1<=m?i<=m:i>=m;b=1<=m?++i:--i)if(f=v(this._sequence,function(a){return 0<=j.call(c.keys,"shift")?!0:"shift"!==a}).slice(-b),c.keys.length===f.length){b=g=0;for(k=f.length;0<=k?g<k:g>k;b=0<=k?++g:--g)if(e=f[b],!(0>j.call(c.keys,"shift")&&"shift"===e)&&!("shift"===a&&0>j.call(c.keys,"shift")))if(c.keys[b]===e)d=!0;else{d=!1;break}}if(d)return c.is_exclusive&&(this._sequence=[]),c}return!1};g.prototype._receive_input=function(a,c){var b,d;if(this._prevent_capture)this._keys_down.length&&
(this._keys_down=[]);else if(b=y(null!=(d=a.keyCode)?d:a.key),(c||this._keys_down.length||!("alt"===b||b===k))&&b)return c?this._key_down(b,a):this._key_up(b,a)};g.prototype._fire=function(a,c,b,d){"function"===typeof c["on_"+a]&&this._prevent_default(b,!0!==c["on_"+a].call(c["this"],b,c.count,d));"release"===a&&(c.count=0);if("keyup"===a)return c.keyup_fired=!0};g.prototype._match_combo_arrays=function(a,c){var b,d,e,f,h;h=this._registered_combos;e=0;for(f=h.length;e<f;e++)d=h[e],b=a.slice(0),d.normalize_caps_lock&&
0<=j.call(b,"caps")&&b.splice(b.indexOf("caps"),1),(!d.is_unordered&&x(b,d.keys)||d.is_unordered&&u(b,d.keys))&&c(d)};g.prototype._fuzzy_match_combo_arrays=function(a,c){var b,d,e,f;f=this._registered_combos;d=0;for(e=f.length;d<e;d++)b=f[d],(!b.is_unordered&&B(b.keys,a)||b.is_unordered&&E(b.keys,a))&&c(b)};g.prototype._keys_remain=function(a){var c,b,d,e;e=a.keys;b=0;for(d=e.length;b<d;b++)if(a=e[b],0<=j.call(this._keys_down,a)){c=!0;break}return c};g.prototype._key_down=function(a,c){var b,d,e,
f,h;(b=z(a,c))&&(a=b);this._add_key_to_sequence(a,c);(b=this._get_sequence(a))&&this._fire("keydown",b,c);for(e in t)b=t[e],c[b]&&(e===a||0<=j.call(this._keys_down,e)||this._keys_down.push(e));for(e in t)if(b=t[e],e!==a&&0<=j.call(this._keys_down,e)&&!c[b]&&!("cmd"===e&&"cmd"!==k)){b=d=0;for(f=this._keys_down.length;0<=f?d<f:d>f;b=0<=f?++d:--d)this._keys_down[b]===e&&this._keys_down.splice(b,1)}d=this._get_active_combos(a);e=this._get_potential_combos(a);f=0;for(h=d.length;f<h;f++)b=d[f],this._handle_combo_down(b,
e,a,c);if(e.length){d=0;for(f=e.length;d<f;d++)b=e[d],this._prevent_default(c,b.prevent_default)}0>j.call(this._keys_down,a)&&this._keys_down.push(a)};g.prototype._handle_combo_down=function(a,c,b,d){var e,f,h,g,k;if(0>j.call(a.keys,b))return!1;this._prevent_default(d,a&&a.prevent_default);e=!1;if(0<=j.call(this._keys_down,b)&&(e=!0,!a.allows_key_repeat()))return!1;h=this._add_to_active_combos(a,b);b=a.keyup_fired=!1;if(a.is_exclusive){g=0;for(k=c.length;g<k;g++)if(f=c[g],f.is_exclusive&&f.keys.length>
a.keys.length){b=!0;break}}if(!b&&(a.is_counting&&"function"===typeof a.on_keydown&&(a.count+=1),h))return this._fire("keydown",a,d,e)};g.prototype._key_up=function(a,c){var b,d,e,f,h,g;b=a;(e=z(a,c))&&(a=e);e=s[b];c.shiftKey?e&&0<=j.call(this._keys_down,e)||(a=b):b&&0<=j.call(this._keys_down,b)||(a=e);(f=this._get_sequence(a))&&this._fire("keyup",f,c);if(0>j.call(this._keys_down,a))return!1;f=h=0;for(g=this._keys_down.length;0<=g?h<g:h>g;f=0<=g?++h:--h)if((d=this._keys_down[f])===a||d===e||d===b){this._keys_down.splice(f,
1);break}d=this._active_combos.length;e=[];g=this._active_combos;f=0;for(h=g.length;f<h;f++)b=g[f],0<=j.call(b.keys,a)&&e.push(b);f=0;for(h=e.length;f<h;f++)b=e[f],this._handle_combo_up(b,c,a);if(1<d){h=this._active_combos;d=0;for(f=h.length;d<f;d++)b=h[d],void 0===b||0<=j.call(e,b)||this._keys_remain(b)||this._remove_from_active_combos(b)}};g.prototype._handle_combo_up=function(a,c,b){var d,e;this._prevent_default(c,a&&a.prevent_default);e=this._keys_remain(a);if(!a.keyup_fired&&(d=this._keys_down.slice(),
d.push(b),!a.is_solitary||u(d,a.keys)))this._fire("keyup",a,c),a.is_counting&&("function"===typeof a.on_keyup&&"function"!==typeof a.on_keydown)&&(a.count+=1);e||(this._fire("release",a,c),this._remove_from_active_combos(a))};g.prototype.simple_combo=function(a,c){return this.register_combo({keys:a,on_keydown:c})};g.prototype.counting_combo=function(a,c){return this.register_combo({keys:a,is_counting:!0,is_unordered:!1,on_keydown:c})};g.prototype.sequence_combo=function(a,c){return this.register_combo({keys:a,
on_keydown:c,is_sequence:!0,is_exclusive:!0})};g.prototype.register_combo=function(a){var c,b,d;"string"===typeof a.keys&&(a.keys=a.keys.split(" "));d=this._defaults;for(c in d)D.call(d,c)&&(b=d[c],void 0===a[c]&&(a[c]=b));a=new w(a);if(H(a))return this._registered_combos.push(a),a};g.prototype.register_many=function(a){var c,b,d,e;e=[];b=0;for(d=a.length;b<d;b++)c=a[b],e.push(this.register_combo(c));return e};g.prototype.unregister_combo=function(a){var c,b,d,e,f,g;if(!a)return!1;var i=this;b=function(a){var b,
c,d,e;e=[];b=c=0;for(d=i._registered_combos.length;0<=d?c<d:c>d;b=0<=d?++c:--c)if(a===i._registered_combos[b]){i._registered_combos.splice(b,1);break}else e.push(void 0);return e};if(a instanceof w)return b(a);if("string"===typeof a){a=a.split(" ");c=d=0;for(e=a.length;0<=e?d<e:d>e;c=0<=e?++d:--d)"meta"===a[c]&&(a[c]=k)}f=this._registered_combos;g=[];d=0;for(e=f.length;d<e;d++)c=f[d],null!=c&&(c.is_unordered&&u(a,c.keys)||!c.is_unordered&&x(a,c.keys)?g.push(b(c)):g.push(void 0));return g};g.prototype.unregister_many=
function(a){var c,b,d,e;e=[];b=0;for(d=a.length;b<d;b++)c=a[b],e.push(this.unregister_combo(c));return e};g.prototype.get_registered_combos=function(){return this._registered_combos};g.prototype.reset=function(){return this._registered_combos=[]};g.prototype.listen=function(){return this._prevent_capture=!1};g.prototype.stop_listening=function(){return this._prevent_capture=!0};g.prototype.get_meta_key=function(){return k};o.Listener=g;y=function(a){return q[a]};v=function(a,c){var b;if(a.filter)return a.filter(c);
var d,e,f;f=[];d=0;for(e=a.length;d<e;d++)b=a[d],c(b)&&f.push(b);return f};u=function(a,c){var b,d,e;if(a.length!==c.length)return!1;d=0;for(e=a.length;d<e;d++)if(b=a[d],!(0<=j.call(c,b)))return!1;return!0};x=function(a,c){var b,d,e;if(a.length!==c.length)return!1;b=d=0;for(e=a.length;0<=e?d<e:d>e;b=0<=e?++d:--d)if(a[b]!==c[b])return!1;return!0};E=function(a,c){var b,d,e;d=0;for(e=a.length;d<e;d++)if(b=a[d],0>j.call(c,b))return!1;return!0};A=Array.prototype.indexOf||function(a,c){var b,d,e;b=d=0;
for(e=a.length;0<=e?d<=e:d>=e;b=0<=e?++d:--d)if(a[b]===c)return b;return-1};B=function(a,c){var b,d,e,f;e=d=0;for(f=a.length;e<f;e++)if(b=a[e],b=A.call(c,b),b>=d)d=b;else return!1;return!0};p=function(){if(o.debug)return console.log.apply(console,arguments)};F=function(a){var c,b,d;c=!1;for(d in q)if(b=q[d],a===b){c=!0;break}if(!c)for(d in s)if(b=s[d],a===b){c=!0;break}return c};H=function(a){var c,b,d,e,f,g,i;f=!0;a.keys.length||p("You're trying to bind a combo with no keys:",a);b=g=0;for(i=a.keys.length;0<=
i?g<i:g>i;b=0<=i?++g:--g)d=a.keys[b],(c=G[d])&&(d=a.keys[b]=c),"meta"===d&&a.keys.splice(b,1,k),"cmd"===d&&p('Warning: use the "meta" key rather than "cmd" for Windows compatibility');i=a.keys;c=0;for(g=i.length;c<g;c++)d=i[c],F(d)||(p('Do not recognize the key "'+d+'"'),f=!1);if(0<=j.call(a.keys,"meta")||0<=j.call(a.keys,"cmd")){c=a.keys.slice();g=0;for(i=C.length;g<i;g++)d=C[g],-1<(b=A.call(c,d))&&c.splice(b,1);1<c.length&&(p("META and CMD key combos cannot have more than 1 non-modifier keys",a,
c),f=!1)}for(e in a)"undefined"===r[e]&&p("The property "+e+" is not a valid combo property. Your combo has still been registered.");return f};z=function(a,c){var b;if(!c.shiftKey)return!1;b=s[a];return null!=b?b:!1};t={cmd:"metaKey",ctrl:"ctrlKey",shift:"shiftKey",alt:"altKey"};G={escape:"esc",control:"ctrl",command:"cmd","break":"pause",windows:"cmd",option:"alt",caps_lock:"caps",apostrophe:"'",semicolon:";",tilde:"~",accent:"`",scroll_lock:"scroll",num_lock:"num"};s={"/":"?",".":">",",":"<","'":'"',
";":":","[":"{","]":"}","\\":"|","`":"~","=":"+","-":"_",1:"!",2:"@",3:"#",4:"$",5:"%",6:"^",7:"&",8:"*",9:"(","0":")"};q={"0":"\\",8:"backspace",9:"tab",12:"num",13:"enter",16:"shift",17:"ctrl",18:"alt",19:"pause",20:"caps",27:"esc",32:"space",33:"pageup",34:"pagedown",35:"end",36:"home",37:"left",38:"up",39:"right",40:"down",44:"print",45:"insert",46:"delete",48:"0",49:"1",50:"2",51:"3",52:"4",53:"5",54:"6",55:"7",56:"8",57:"9",65:"a",66:"b",67:"c",68:"d",69:"e",70:"f",71:"g",72:"h",73:"i",74:"j",
75:"k",76:"l",77:"m",78:"n",79:"o",80:"p",81:"q",82:"r",83:"s",84:"t",85:"u",86:"v",87:"w",88:"x",89:"y",90:"z",91:"cmd",92:"cmd",93:"cmd",96:"num_0",97:"num_1",98:"num_2",99:"num_3",100:"num_4",101:"num_5",102:"num_6",103:"num_7",104:"num_8",105:"num_9",106:"num_multiply",107:"num_add",108:"num_enter",109:"num_subtract",110:"num_decimal",111:"num_divide",112:"f1",113:"f2",114:"f3",115:"f4",116:"f5",117:"f6",118:"f7",119:"f8",120:"f9",121:"f10",122:"f11",123:"f12",124:"print",144:"num",145:"scroll",
186:";",187:"=",188:",",189:"-",190:".",191:"/",192:"`",219:"[",220:"\\",221:"]",222:"'",223:"`",224:"cmd",225:"alt",57392:"ctrl",63289:"num",59:";",61:"=",173:"-"};o._keycode_dictionary=q;o._is_array_in_array_sorted=B;-1!==navigator.userAgent.indexOf("Mac OS X")&&(k="cmd");-1!==navigator.userAgent.indexOf("Opera")&&(q["17"]="cmd");"function"===typeof define&&define.amd?define([],function(){return o}):"undefined"!==typeof exports&&null!==exports?exports.keypress=o:window.keypress=o}).call(this);

},{}],64:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],65:[function(require,module,exports){
'use strict';

function Decoder(buffer) {
  this.offset = 0;
  if (buffer instanceof ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(this.buffer);
  } else if (ArrayBuffer.isView(buffer)) {
    this.buffer = buffer.buffer;
    this.view = new DataView(this.buffer, buffer.byteOffset, buffer.byteLength);
  } else {
    throw new Error('Invalid argument');
  }
}

function utf8Read(view, offset, length) {
  var string = '', chr = 0;
  for (var i = offset, end = offset + length; i < end; i++) {
    var byte = view.getUint8(i);
    if ((byte & 0x80) === 0x00) {
      string += String.fromCharCode(byte);
      continue;
    }
    if ((byte & 0xe0) === 0xc0) {
      string += String.fromCharCode(
        ((byte & 0x1f) << 6) |
        (view.getUint8(++i) & 0x3f)
      );
      continue;
    }
    if ((byte & 0xf0) === 0xe0) {
      string += String.fromCharCode(
        ((byte & 0x0f) << 12) |
        ((view.getUint8(++i) & 0x3f) << 6) |
        ((view.getUint8(++i) & 0x3f) << 0)
      );
      continue;
    }
    if ((byte & 0xf8) === 0xf0) {
      chr = ((byte & 0x07) << 18) |
        ((view.getUint8(++i) & 0x3f) << 12) |
        ((view.getUint8(++i) & 0x3f) << 6) |
        ((view.getUint8(++i) & 0x3f) << 0);
      if (chr >= 0x010000) { // surrogate pair
        chr -= 0x010000;
        string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
      } else {
        string += String.fromCharCode(chr);
      }
      continue;
    }
    throw new Error('Invalid byte ' + byte.toString(16));
  }
  return string;
}

Decoder.prototype.array = function (length) {
  var value = new Array(length);
  for (var i = 0; i < length; i++) {
    value[i] = this.parse();
  }
  return value;
};

Decoder.prototype.map = function (length) {
  var key = '', value = {};
  for (var i = 0; i < length; i++) {
    key = this.parse();
    value[key] = this.parse();
  }
  return value;
};

Decoder.prototype.str = function (length) {
  var value = utf8Read(this.view, this.offset, length);
  this.offset += length;
  return value;
};

Decoder.prototype.bin = function (length) {
  var value = this.buffer.slice(this.offset, this.offset + length);
  this.offset += length;
  return value;
};

Decoder.prototype.parse = function () {
  var prefix = this.view.getUint8(this.offset++);
  var value, length = 0, type = 0, hi = 0, lo = 0;

  if (prefix < 0xc0) {
    // positive fixint
    if (prefix < 0x80) {
      return prefix;
    }
    // fixmap
    if (prefix < 0x90) {
      return this.map(prefix & 0x0f);
    }
    // fixarray
    if (prefix < 0xa0) {
      return this.array(prefix & 0x0f);
    }
    // fixstr
    return this.str(prefix & 0x1f);
  }

  // negative fixint
  if (prefix > 0xdf) {
    return (0xff - prefix + 1) * -1;
  }

  switch (prefix) {
    // nil
    case 0xc0:
      return null;
    // false
    case 0xc2:
      return false;
    // true
    case 0xc3:
      return true;

    // bin
    case 0xc4:
      length = this.view.getUint8(this.offset);
      this.offset += 1;
      return this.bin(length);
    case 0xc5:
      length = this.view.getUint16(this.offset);
      this.offset += 2;
      return this.bin(length);
    case 0xc6:
      length = this.view.getUint32(this.offset);
      this.offset += 4;
      return this.bin(length);

    // ext
    case 0xc7:
      length = this.view.getUint8(this.offset);
      type = this.view.getInt8(this.offset + 1);
      this.offset += 2;
      return [type, this.bin(length)];
    case 0xc8:
      length = this.view.getUint16(this.offset);
      type = this.view.getInt8(this.offset + 2);
      this.offset += 3;
      return [type, this.bin(length)];
    case 0xc9:
      length = this.view.getUint32(this.offset);
      type = this.view.getInt8(this.offset + 4);
      this.offset += 5;
      return [type, this.bin(length)];

    // float
    case 0xca:
      value = this.view.getFloat32(this.offset);
      this.offset += 4;
      return value;
    case 0xcb:
      value = this.view.getFloat64(this.offset);
      this.offset += 8;
      return value;

    // uint
    case 0xcc:
      value = this.view.getUint8(this.offset);
      this.offset += 1;
      return value;
    case 0xcd:
      value = this.view.getUint16(this.offset);
      this.offset += 2;
      return value;
    case 0xce:
      value = this.view.getUint32(this.offset);
      this.offset += 4;
      return value;
    case 0xcf:
      hi = this.view.getUint32(this.offset) * Math.pow(2, 32);
      lo = this.view.getUint32(this.offset + 4);
      this.offset += 8;
      return hi + lo;

    // int
    case 0xd0:
      value = this.view.getInt8(this.offset);
      this.offset += 1;
      return value;
    case 0xd1:
      value = this.view.getInt16(this.offset);
      this.offset += 2;
      return value;
    case 0xd2:
      value = this.view.getInt32(this.offset);
      this.offset += 4;
      return value;
    case 0xd3:
      hi = this.view.getInt32(this.offset) * Math.pow(2, 32);
      lo = this.view.getUint32(this.offset + 4);
      this.offset += 8;
      return hi + lo;

    // fixext
    case 0xd4:
      type = this.view.getInt8(this.offset);
      this.offset += 1;
      if (type === 0x00) {
        this.offset += 1;
        return void 0;
      }
      return [type, this.bin(1)];
    case 0xd5:
      type = this.view.getInt8(this.offset);
      this.offset += 1;
      return [type, this.bin(2)];
    case 0xd6:
      type = this.view.getInt8(this.offset);
      this.offset += 1;
      return [type, this.bin(4)];
    case 0xd7:
      type = this.view.getInt8(this.offset);
      this.offset += 1;
      if (type === 0x00) {
        hi = this.view.getInt32(this.offset) * Math.pow(2, 32);
        lo = this.view.getUint32(this.offset + 4);
        this.offset += 8;
        return new Date(hi + lo);
      }
      return [type, this.bin(8)];
    case 0xd8:
      type = this.view.getInt8(this.offset);
      this.offset += 1;
      return [type, this.bin(16)];

    // str
    case 0xd9:
      length = this.view.getUint8(this.offset);
      this.offset += 1;
      return this.str(length);
    case 0xda:
      length = this.view.getUint16(this.offset);
      this.offset += 2;
      return this.str(length);
    case 0xdb:
      length = this.view.getUint32(this.offset);
      this.offset += 4;
      return this.str(length);

    // array
    case 0xdc:
      length = this.view.getUint16(this.offset);
      this.offset += 2;
      return this.array(length);
    case 0xdd:
      length = this.view.getUint32(this.offset);
      this.offset += 4;
      return this.array(length);

    // map
    case 0xde:
      length = this.view.getUint16(this.offset);
      this.offset += 2;
      return this.map(length);
    case 0xdf:
      length = this.view.getUint32(this.offset);
      this.offset += 4;
      return this.map(length);
  }

  throw new Error('Could not parse');
};

function decode(buffer) {
  var decoder = new Decoder(buffer);
  var value = decoder.parse();
  if (decoder.offset !== buffer.byteLength) {
    throw new Error((buffer.byteLength - decoder.offset) + ' trailing bytes');
  }
  return value;
}

module.exports = decode;

},{}],66:[function(require,module,exports){
'use strict';

function utf8Write(view, offset, str) {
  var c = 0;
  for (var i = 0, l = str.length; i < l; i++) {
    c = str.charCodeAt(i);
    if (c < 0x80) {
      view.setUint8(offset++, c);
    }
    else if (c < 0x800) {
      view.setUint8(offset++, 0xc0 | (c >> 6));
      view.setUint8(offset++, 0x80 | (c & 0x3f));
    }
    else if (c < 0xd800 || c >= 0xe000) {
      view.setUint8(offset++, 0xe0 | (c >> 12));
      view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
      view.setUint8(offset++, 0x80 | (c & 0x3f));
    }
    else {
      i++;
      c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      view.setUint8(offset++, 0xf0 | (c >> 18));
      view.setUint8(offset++, 0x80 | (c >> 12) & 0x3f);
      view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
      view.setUint8(offset++, 0x80 | (c & 0x3f));
    }
  }
}

function utf8Length(str) {
  var c = 0, length = 0;
  for (var i = 0, l = str.length; i < l; i++) {
    c = str.charCodeAt(i);
    if (c < 0x80) {
      length += 1;
    }
    else if (c < 0x800) {
      length += 2;
    }
    else if (c < 0xd800 || c >= 0xe000) {
      length += 3;
    }
    else {
      i++;
      length += 4;
    }
  }
  return length;
}

function _encode(bytes, defers, value) {
  var type = typeof value, i = 0, l = 0, hi = 0, lo = 0, length = 0, size = 0;

  if (type === 'string') {
    length = utf8Length(value);

    // fixstr
    if (length < 0x20) {
      bytes.push(length | 0xa0);
      size = 1;
    }
    // str 8
    else if (length < 0x100) {
      bytes.push(0xd9, length);
      size = 2;
    }
    // str 16
    else if (length < 0x10000) {
      bytes.push(0xda, length >> 8, length);
      size = 3;
    }
    // str 32
    else if (length < 0x100000000) {
      bytes.push(0xdb, length >> 24, length >> 16, length >> 8, length);
      size = 5;
    } else {
      throw new Error('String too long');
    }
    defers.push({ str: value, length: length, offset: bytes.length });
    return size + length;
  }
  if (type === 'number') {
    // TODO: encode to float 32?

    // float 64
    if (Math.floor(value) !== value || !isFinite(value)) {
      bytes.push(0xcb);
      defers.push({ float: value, length: 8, offset: bytes.length });
      return 9;
    }

    if (value >= 0) {
      // positive fixnum
      if (value < 0x80) {
        bytes.push(value);
        return 1;
      }
      // uint 8
      if (value < 0x100) {
        bytes.push(0xcc, value);
        return 2;
      }
      // uint 16
      if (value < 0x10000) {
        bytes.push(0xcd, value >> 8, value);
        return 3;
      }
      // uint 32
      if (value < 0x100000000) {
        bytes.push(0xce, value >> 24, value >> 16, value >> 8, value);
        return 5;
      }
      // uint 64
      hi = (value / Math.pow(2, 32)) >> 0;
      lo = value >>> 0;
      bytes.push(0xcf, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
      return 9;
    } else {
      // negative fixnum
      if (value >= -0x20) {
        bytes.push(value);
        return 1;
      }
      // int 8
      if (value >= -0x80) {
        bytes.push(0xd0, value);
        return 2;
      }
      // int 16
      if (value >= -0x8000) {
        bytes.push(0xd1, value >> 8, value);
        return 3;
      }
      // int 32
      if (value >= -0x80000000) {
        bytes.push(0xd2, value >> 24, value >> 16, value >> 8, value);
        return 5;
      }
      // int 64
      hi = Math.floor(value / Math.pow(2, 32));
      lo = value >>> 0;
      bytes.push(0xd3, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
      return 9;
    }
  }
  if (type === 'object') {
    // nil
    if (value === null) {
      bytes.push(0xc0);
      return 1;
    }

    if (Array.isArray(value)) {
      length = value.length;

      // fixarray
      if (length < 0x10) {
        bytes.push(length | 0x90);
        size = 1;
      }
      // array 16
      else if (length < 0x10000) {
        bytes.push(0xdc, length >> 8, length);
        size = 3;
      }
      // array 32
      else if (length < 0x100000000) {
        bytes.push(0xdd, length >> 24, length >> 16, length >> 8, length);
        size = 5;
      } else {
        throw new Error('Array too large');
      }
      for (i = 0; i < length; i++) {
        size += _encode(bytes, defers, value[i]);
      }
      return size;
    }

    // fixext 8 / Date
    if (value instanceof Date) {
      var time = value.getTime();
      hi = Math.floor(time / Math.pow(2, 32));
      lo = time >>> 0;
      bytes.push(0xd7, 0, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
      return 10;
    }

    if (value instanceof ArrayBuffer) {
      length = value.byteLength;

      // bin 8
      if (length < 0x100) {
        bytes.push(0xc4, length);
        size = 2;
      } else
      // bin 16
      if (length < 0x10000) {
        bytes.push(0xc5, length >> 8, length);
        size = 3;
      } else
      // bin 32
      if (length < 0x100000000) {
        bytes.push(0xc6, length >> 24, length >> 16, length >> 8, length);
        size = 5;
      } else {
        throw new Error('Buffer too large');
      }
      defers.push({ bin: value, length: length, offset: bytes.length });
      return size + length;
    }

    if (typeof value.toJSON === 'function') {
      return _encode(bytes, defers, value.toJSON());
    }

    var keys = [], key = '';

    var allKeys = Object.keys(value);
    for (i = 0, l = allKeys.length; i < l; i++) {
      key = allKeys[i];
      if (typeof value[key] !== 'function') {
        keys.push(key);
      }
    }
    length = keys.length;

    // fixmap
    if (length < 0x10) {
      bytes.push(length | 0x80);
      size = 1;
    }
    // map 16
    else if (length < 0x10000) {
      bytes.push(0xde, length >> 8, length);
      size = 3;
    }
    // map 32
    else if (length < 0x100000000) {
      bytes.push(0xdf, length >> 24, length >> 16, length >> 8, length);
      size = 5;
    } else {
      throw new Error('Object too large');
    }

    for (i = 0; i < length; i++) {
      key = keys[i];
      size += _encode(bytes, defers, key);
      size += _encode(bytes, defers, value[key]);
    }
    return size;
  }
  // false/true
  if (type === 'boolean') {
    bytes.push(value ? 0xc3 : 0xc2);
    return 1;
  }
  // fixext 1 / undefined
  if (type === 'undefined') {
    bytes.push(0xd4, 0, 0);
    return 3;
  }
  throw new Error('Could not encode');
}

function encode(value) {
  var bytes = [];
  var defers = [];
  var size = _encode(bytes, defers, value);
  var buf = new ArrayBuffer(size);
  var view = new DataView(buf);

  var deferIndex = 0;
  var deferWritten = 0;
  var nextOffset = -1;
  if (defers.length > 0) {
    nextOffset = defers[0].offset;
  }

  var defer, deferLength = 0, offset = 0;
  for (var i = 0, l = bytes.length; i < l; i++) {
    view.setUint8(deferWritten + i, bytes[i]);
    if (i + 1 !== nextOffset) { continue; }
    defer = defers[deferIndex];
    deferLength = defer.length;
    offset = deferWritten + nextOffset;
    if (defer.bin) {
      var bin = new Uint8Array(defer.bin);
      for (var j = 0; j < deferLength; j++) {
        view.setUint8(offset + j, bin[j]);
      }
    } else if (defer.str) {
      utf8Write(view, offset, defer.str);
    } else if (defer.float !== undefined) {
      view.setFloat64(offset, defer.float);
    }
    deferIndex++;
    deferWritten += deferLength;
    if (defers[deferIndex]) {
      nextOffset = defers[deferIndex].offset;
    }
  }
  return buf;
}

module.exports = encode;

},{}],67:[function(require,module,exports){
exports.encode = require('./encode');
exports.decode = require('./decode');

},{"./decode":65,"./encode":66}],68:[function(require,module,exports){
/**
 * Compiles a querystring
 * Returns string representation of the object
 *
 * @param {Object}
 * @api private
 */

exports.encode = function (obj) {
  var str = '';

  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      if (str.length) str += '&';
      str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
    }
  }

  return str;
};

/**
 * Parses a simple querystring into an object
 *
 * @param {String} qs
 * @api private
 */

exports.decode = function(qs){
  var qry = {};
  var pairs = qs.split('&');
  for (var i = 0, l = pairs.length; i < l; i++) {
    var pair = pairs[i].split('=');
    qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return qry;
};

},{}],69:[function(require,module,exports){
/**
 * Parses an URI
 *
 * @author Steven Levithan <stevenlevithan.com> (MIT license)
 * @api private
 */

var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

var parts = [
    'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
];

module.exports = function parseuri(str) {
    var src = str,
        b = str.indexOf('['),
        e = str.indexOf(']');

    if (b != -1 && e != -1) {
        str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
    }

    var m = re.exec(str || ''),
        uri = {},
        i = 14;

    while (i--) {
        uri[parts[i]] = m[i] || '';
    }

    if (b != -1 && e != -1) {
        uri.source = src;
        uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
        uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
        uri.ipv6uri = true;
    }

    return uri;
};

},{}],70:[function(require,module,exports){

/**
 * Module dependencies.
 */

var url = require('./url');
var parser = require('socket.io-parser');
var Manager = require('./manager');
var debug = require('debug')('socket.io-client');

/**
 * Module exports.
 */

module.exports = exports = lookup;

/**
 * Managers cache.
 */

var cache = exports.managers = {};

/**
 * Looks up an existing `Manager` for multiplexing.
 * If the user summons:
 *
 *   `io('http://localhost/a');`
 *   `io('http://localhost/b');`
 *
 * We reuse the existing instance based on same scheme/port/host,
 * and we initialize sockets for each namespace.
 *
 * @api public
 */

function lookup (uri, opts) {
  if (typeof uri === 'object') {
    opts = uri;
    uri = undefined;
  }

  opts = opts || {};

  var parsed = url(uri);
  var source = parsed.source;
  var id = parsed.id;
  var path = parsed.path;
  var sameNamespace = cache[id] && path in cache[id].nsps;
  var newConnection = opts.forceNew || opts['force new connection'] ||
                      false === opts.multiplex || sameNamespace;

  var io;

  if (newConnection) {
    debug('ignoring socket cache for %s', source);
    io = Manager(source, opts);
  } else {
    if (!cache[id]) {
      debug('new io instance for %s', source);
      cache[id] = Manager(source, opts);
    }
    io = cache[id];
  }
  if (parsed.query && !opts.query) {
    opts.query = parsed.query;
  }
  return io.socket(parsed.path, opts);
}

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = parser.protocol;

/**
 * `connect`.
 *
 * @param {String} uri
 * @api public
 */

exports.connect = lookup;

/**
 * Expose constructors for standalone build.
 *
 * @api public
 */

exports.Manager = require('./manager');
exports.Socket = require('./socket');

},{"./manager":71,"./socket":73,"./url":74,"debug":75,"socket.io-parser":79}],71:[function(require,module,exports){

/**
 * Module dependencies.
 */

var eio = require('engine.io-client');
var Socket = require('./socket');
var Emitter = require('component-emitter');
var parser = require('socket.io-parser');
var on = require('./on');
var bind = require('component-bind');
var debug = require('debug')('socket.io-client:manager');
var indexOf = require('indexof');
var Backoff = require('backo2');

/**
 * IE6+ hasOwnProperty
 */

var has = Object.prototype.hasOwnProperty;

/**
 * Module exports
 */

module.exports = Manager;

/**
 * `Manager` constructor.
 *
 * @param {String} engine instance or engine uri/opts
 * @param {Object} options
 * @api public
 */

function Manager (uri, opts) {
  if (!(this instanceof Manager)) return new Manager(uri, opts);
  if (uri && ('object' === typeof uri)) {
    opts = uri;
    uri = undefined;
  }
  opts = opts || {};

  opts.path = opts.path || '/socket.io';
  this.nsps = {};
  this.subs = [];
  this.opts = opts;
  this.reconnection(opts.reconnection !== false);
  this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
  this.reconnectionDelay(opts.reconnectionDelay || 1000);
  this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
  this.randomizationFactor(opts.randomizationFactor || 0.5);
  this.backoff = new Backoff({
    min: this.reconnectionDelay(),
    max: this.reconnectionDelayMax(),
    jitter: this.randomizationFactor()
  });
  this.timeout(null == opts.timeout ? 20000 : opts.timeout);
  this.readyState = 'closed';
  this.uri = uri;
  this.connecting = [];
  this.lastPing = null;
  this.encoding = false;
  this.packetBuffer = [];
  var _parser = opts.parser || parser;
  this.encoder = new _parser.Encoder();
  this.decoder = new _parser.Decoder();
  this.autoConnect = opts.autoConnect !== false;
  if (this.autoConnect) this.open();
}

/**
 * Propagate given event to sockets and emit on `this`
 *
 * @api private
 */

Manager.prototype.emitAll = function () {
  this.emit.apply(this, arguments);
  for (var nsp in this.nsps) {
    if (has.call(this.nsps, nsp)) {
      this.nsps[nsp].emit.apply(this.nsps[nsp], arguments);
    }
  }
};

/**
 * Update `socket.id` of all sockets
 *
 * @api private
 */

Manager.prototype.updateSocketIds = function () {
  for (var nsp in this.nsps) {
    if (has.call(this.nsps, nsp)) {
      this.nsps[nsp].id = this.generateId(nsp);
    }
  }
};

/**
 * generate `socket.id` for the given `nsp`
 *
 * @param {String} nsp
 * @return {String}
 * @api private
 */

Manager.prototype.generateId = function (nsp) {
  return (nsp === '/' ? '' : (nsp + '#')) + this.engine.id;
};

/**
 * Mix in `Emitter`.
 */

Emitter(Manager.prototype);

/**
 * Sets the `reconnection` config.
 *
 * @param {Boolean} true/false if it should automatically reconnect
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnection = function (v) {
  if (!arguments.length) return this._reconnection;
  this._reconnection = !!v;
  return this;
};

/**
 * Sets the reconnection attempts config.
 *
 * @param {Number} max reconnection attempts before giving up
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionAttempts = function (v) {
  if (!arguments.length) return this._reconnectionAttempts;
  this._reconnectionAttempts = v;
  return this;
};

/**
 * Sets the delay between reconnections.
 *
 * @param {Number} delay
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionDelay = function (v) {
  if (!arguments.length) return this._reconnectionDelay;
  this._reconnectionDelay = v;
  this.backoff && this.backoff.setMin(v);
  return this;
};

Manager.prototype.randomizationFactor = function (v) {
  if (!arguments.length) return this._randomizationFactor;
  this._randomizationFactor = v;
  this.backoff && this.backoff.setJitter(v);
  return this;
};

/**
 * Sets the maximum delay between reconnections.
 *
 * @param {Number} delay
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionDelayMax = function (v) {
  if (!arguments.length) return this._reconnectionDelayMax;
  this._reconnectionDelayMax = v;
  this.backoff && this.backoff.setMax(v);
  return this;
};

/**
 * Sets the connection timeout. `false` to disable
 *
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.timeout = function (v) {
  if (!arguments.length) return this._timeout;
  this._timeout = v;
  return this;
};

/**
 * Starts trying to reconnect if reconnection is enabled and we have not
 * started reconnecting yet
 *
 * @api private
 */

Manager.prototype.maybeReconnectOnOpen = function () {
  // Only try to reconnect if it's the first time we're connecting
  if (!this.reconnecting && this._reconnection && this.backoff.attempts === 0) {
    // keeps reconnection from firing twice for the same reconnection loop
    this.reconnect();
  }
};

/**
 * Sets the current transport `socket`.
 *
 * @param {Function} optional, callback
 * @return {Manager} self
 * @api public
 */

Manager.prototype.open =
Manager.prototype.connect = function (fn, opts) {
  debug('readyState %s', this.readyState);
  if (~this.readyState.indexOf('open')) return this;

  debug('opening %s', this.uri);
  this.engine = eio(this.uri, this.opts);
  var socket = this.engine;
  var self = this;
  this.readyState = 'opening';
  this.skipReconnect = false;

  // emit `open`
  var openSub = on(socket, 'open', function () {
    self.onopen();
    fn && fn();
  });

  // emit `connect_error`
  var errorSub = on(socket, 'error', function (data) {
    debug('connect_error');
    self.cleanup();
    self.readyState = 'closed';
    self.emitAll('connect_error', data);
    if (fn) {
      var err = new Error('Connection error');
      err.data = data;
      fn(err);
    } else {
      // Only do this if there is no fn to handle the error
      self.maybeReconnectOnOpen();
    }
  });

  // emit `connect_timeout`
  if (false !== this._timeout) {
    var timeout = this._timeout;
    debug('connect attempt will timeout after %d', timeout);

    // set timer
    var timer = setTimeout(function () {
      debug('connect attempt timed out after %d', timeout);
      openSub.destroy();
      socket.close();
      socket.emit('error', 'timeout');
      self.emitAll('connect_timeout', timeout);
    }, timeout);

    this.subs.push({
      destroy: function () {
        clearTimeout(timer);
      }
    });
  }

  this.subs.push(openSub);
  this.subs.push(errorSub);

  return this;
};

/**
 * Called upon transport open.
 *
 * @api private
 */

Manager.prototype.onopen = function () {
  debug('open');

  // clear old subs
  this.cleanup();

  // mark as open
  this.readyState = 'open';
  this.emit('open');

  // add new subs
  var socket = this.engine;
  this.subs.push(on(socket, 'data', bind(this, 'ondata')));
  this.subs.push(on(socket, 'ping', bind(this, 'onping')));
  this.subs.push(on(socket, 'pong', bind(this, 'onpong')));
  this.subs.push(on(socket, 'error', bind(this, 'onerror')));
  this.subs.push(on(socket, 'close', bind(this, 'onclose')));
  this.subs.push(on(this.decoder, 'decoded', bind(this, 'ondecoded')));
};

/**
 * Called upon a ping.
 *
 * @api private
 */

Manager.prototype.onping = function () {
  this.lastPing = new Date();
  this.emitAll('ping');
};

/**
 * Called upon a packet.
 *
 * @api private
 */

Manager.prototype.onpong = function () {
  this.emitAll('pong', new Date() - this.lastPing);
};

/**
 * Called with data.
 *
 * @api private
 */

Manager.prototype.ondata = function (data) {
  this.decoder.add(data);
};

/**
 * Called when parser fully decodes a packet.
 *
 * @api private
 */

Manager.prototype.ondecoded = function (packet) {
  this.emit('packet', packet);
};

/**
 * Called upon socket error.
 *
 * @api private
 */

Manager.prototype.onerror = function (err) {
  debug('error', err);
  this.emitAll('error', err);
};

/**
 * Creates a new socket for the given `nsp`.
 *
 * @return {Socket}
 * @api public
 */

Manager.prototype.socket = function (nsp, opts) {
  var socket = this.nsps[nsp];
  if (!socket) {
    socket = new Socket(this, nsp, opts);
    this.nsps[nsp] = socket;
    var self = this;
    socket.on('connecting', onConnecting);
    socket.on('connect', function () {
      socket.id = self.generateId(nsp);
    });

    if (this.autoConnect) {
      // manually call here since connecting event is fired before listening
      onConnecting();
    }
  }

  function onConnecting () {
    if (!~indexOf(self.connecting, socket)) {
      self.connecting.push(socket);
    }
  }

  return socket;
};

/**
 * Called upon a socket close.
 *
 * @param {Socket} socket
 */

Manager.prototype.destroy = function (socket) {
  var index = indexOf(this.connecting, socket);
  if (~index) this.connecting.splice(index, 1);
  if (this.connecting.length) return;

  this.close();
};

/**
 * Writes a packet.
 *
 * @param {Object} packet
 * @api private
 */

Manager.prototype.packet = function (packet) {
  debug('writing packet %j', packet);
  var self = this;
  if (packet.query && packet.type === 0) packet.nsp += '?' + packet.query;

  if (!self.encoding) {
    // encode, then write to engine with result
    self.encoding = true;
    this.encoder.encode(packet, function (encodedPackets) {
      for (var i = 0; i < encodedPackets.length; i++) {
        self.engine.write(encodedPackets[i], packet.options);
      }
      self.encoding = false;
      self.processPacketQueue();
    });
  } else { // add packet to the queue
    self.packetBuffer.push(packet);
  }
};

/**
 * If packet buffer is non-empty, begins encoding the
 * next packet in line.
 *
 * @api private
 */

Manager.prototype.processPacketQueue = function () {
  if (this.packetBuffer.length > 0 && !this.encoding) {
    var pack = this.packetBuffer.shift();
    this.packet(pack);
  }
};

/**
 * Clean up transport subscriptions and packet buffer.
 *
 * @api private
 */

Manager.prototype.cleanup = function () {
  debug('cleanup');

  var subsLength = this.subs.length;
  for (var i = 0; i < subsLength; i++) {
    var sub = this.subs.shift();
    sub.destroy();
  }

  this.packetBuffer = [];
  this.encoding = false;
  this.lastPing = null;

  this.decoder.destroy();
};

/**
 * Close the current socket.
 *
 * @api private
 */

Manager.prototype.close =
Manager.prototype.disconnect = function () {
  debug('disconnect');
  this.skipReconnect = true;
  this.reconnecting = false;
  if ('opening' === this.readyState) {
    // `onclose` will not fire because
    // an open event never happened
    this.cleanup();
  }
  this.backoff.reset();
  this.readyState = 'closed';
  if (this.engine) this.engine.close();
};

/**
 * Called upon engine close.
 *
 * @api private
 */

Manager.prototype.onclose = function (reason) {
  debug('onclose');

  this.cleanup();
  this.backoff.reset();
  this.readyState = 'closed';
  this.emit('close', reason);

  if (this._reconnection && !this.skipReconnect) {
    this.reconnect();
  }
};

/**
 * Attempt a reconnection.
 *
 * @api private
 */

Manager.prototype.reconnect = function () {
  if (this.reconnecting || this.skipReconnect) return this;

  var self = this;

  if (this.backoff.attempts >= this._reconnectionAttempts) {
    debug('reconnect failed');
    this.backoff.reset();
    this.emitAll('reconnect_failed');
    this.reconnecting = false;
  } else {
    var delay = this.backoff.duration();
    debug('will wait %dms before reconnect attempt', delay);

    this.reconnecting = true;
    var timer = setTimeout(function () {
      if (self.skipReconnect) return;

      debug('attempting reconnect');
      self.emitAll('reconnect_attempt', self.backoff.attempts);
      self.emitAll('reconnecting', self.backoff.attempts);

      // check again for the case socket closed in above events
      if (self.skipReconnect) return;

      self.open(function (err) {
        if (err) {
          debug('reconnect attempt error');
          self.reconnecting = false;
          self.reconnect();
          self.emitAll('reconnect_error', err.data);
        } else {
          debug('reconnect success');
          self.onreconnect();
        }
      });
    }, delay);

    this.subs.push({
      destroy: function () {
        clearTimeout(timer);
      }
    });
  }
};

/**
 * Called upon successful reconnect.
 *
 * @api private
 */

Manager.prototype.onreconnect = function () {
  var attempt = this.backoff.attempts;
  this.reconnecting = false;
  this.backoff.reset();
  this.updateSocketIds();
  this.emitAll('reconnect', attempt);
};

},{"./on":72,"./socket":73,"backo2":30,"component-bind":33,"component-emitter":34,"debug":75,"engine.io-client":45,"indexof":62,"socket.io-parser":79}],72:[function(require,module,exports){

/**
 * Module exports.
 */

module.exports = on;

/**
 * Helper for subscriptions.
 *
 * @param {Object|EventEmitter} obj with `Emitter` mixin or `EventEmitter`
 * @param {String} event name
 * @param {Function} callback
 * @api public
 */

function on (obj, ev, fn) {
  obj.on(ev, fn);
  return {
    destroy: function () {
      obj.removeListener(ev, fn);
    }
  };
}

},{}],73:[function(require,module,exports){

/**
 * Module dependencies.
 */

var parser = require('socket.io-parser');
var Emitter = require('component-emitter');
var toArray = require('to-array');
var on = require('./on');
var bind = require('component-bind');
var debug = require('debug')('socket.io-client:socket');
var parseqs = require('parseqs');
var hasBin = require('has-binary2');

/**
 * Module exports.
 */

module.exports = exports = Socket;

/**
 * Internal events (blacklisted).
 * These events can't be emitted by the user.
 *
 * @api private
 */

var events = {
  connect: 1,
  connect_error: 1,
  connect_timeout: 1,
  connecting: 1,
  disconnect: 1,
  error: 1,
  reconnect: 1,
  reconnect_attempt: 1,
  reconnect_failed: 1,
  reconnect_error: 1,
  reconnecting: 1,
  ping: 1,
  pong: 1
};

/**
 * Shortcut to `Emitter#emit`.
 */

var emit = Emitter.prototype.emit;

/**
 * `Socket` constructor.
 *
 * @api public
 */

function Socket (io, nsp, opts) {
  this.io = io;
  this.nsp = nsp;
  this.json = this; // compat
  this.ids = 0;
  this.acks = {};
  this.receiveBuffer = [];
  this.sendBuffer = [];
  this.connected = false;
  this.disconnected = true;
  this.flags = {};
  if (opts && opts.query) {
    this.query = opts.query;
  }
  if (this.io.autoConnect) this.open();
}

/**
 * Mix in `Emitter`.
 */

Emitter(Socket.prototype);

/**
 * Subscribe to open, close and packet events
 *
 * @api private
 */

Socket.prototype.subEvents = function () {
  if (this.subs) return;

  var io = this.io;
  this.subs = [
    on(io, 'open', bind(this, 'onopen')),
    on(io, 'packet', bind(this, 'onpacket')),
    on(io, 'close', bind(this, 'onclose'))
  ];
};

/**
 * "Opens" the socket.
 *
 * @api public
 */

Socket.prototype.open =
Socket.prototype.connect = function () {
  if (this.connected) return this;

  this.subEvents();
  this.io.open(); // ensure open
  if ('open' === this.io.readyState) this.onopen();
  this.emit('connecting');
  return this;
};

/**
 * Sends a `message` event.
 *
 * @return {Socket} self
 * @api public
 */

Socket.prototype.send = function () {
  var args = toArray(arguments);
  args.unshift('message');
  this.emit.apply(this, args);
  return this;
};

/**
 * Override `emit`.
 * If the event is in `events`, it's emitted normally.
 *
 * @param {String} event name
 * @return {Socket} self
 * @api public
 */

Socket.prototype.emit = function (ev) {
  if (events.hasOwnProperty(ev)) {
    emit.apply(this, arguments);
    return this;
  }

  var args = toArray(arguments);
  var packet = {
    type: (this.flags.binary !== undefined ? this.flags.binary : hasBin(args)) ? parser.BINARY_EVENT : parser.EVENT,
    data: args
  };

  packet.options = {};
  packet.options.compress = !this.flags || false !== this.flags.compress;

  // event ack callback
  if ('function' === typeof args[args.length - 1]) {
    debug('emitting packet with ack id %d', this.ids);
    this.acks[this.ids] = args.pop();
    packet.id = this.ids++;
  }

  if (this.connected) {
    this.packet(packet);
  } else {
    this.sendBuffer.push(packet);
  }

  this.flags = {};

  return this;
};

/**
 * Sends a packet.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.packet = function (packet) {
  packet.nsp = this.nsp;
  this.io.packet(packet);
};

/**
 * Called upon engine `open`.
 *
 * @api private
 */

Socket.prototype.onopen = function () {
  debug('transport is open - connecting');

  // write connect packet if necessary
  if ('/' !== this.nsp) {
    if (this.query) {
      var query = typeof this.query === 'object' ? parseqs.encode(this.query) : this.query;
      debug('sending connect packet with query %s', query);
      this.packet({type: parser.CONNECT, query: query});
    } else {
      this.packet({type: parser.CONNECT});
    }
  }
};

/**
 * Called upon engine `close`.
 *
 * @param {String} reason
 * @api private
 */

Socket.prototype.onclose = function (reason) {
  debug('close (%s)', reason);
  this.connected = false;
  this.disconnected = true;
  delete this.id;
  this.emit('disconnect', reason);
};

/**
 * Called with socket packet.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onpacket = function (packet) {
  var sameNamespace = packet.nsp === this.nsp;
  var rootNamespaceError = packet.type === parser.ERROR && packet.nsp === '/';

  if (!sameNamespace && !rootNamespaceError) return;

  switch (packet.type) {
    case parser.CONNECT:
      this.onconnect();
      break;

    case parser.EVENT:
      this.onevent(packet);
      break;

    case parser.BINARY_EVENT:
      this.onevent(packet);
      break;

    case parser.ACK:
      this.onack(packet);
      break;

    case parser.BINARY_ACK:
      this.onack(packet);
      break;

    case parser.DISCONNECT:
      this.ondisconnect();
      break;

    case parser.ERROR:
      this.emit('error', packet.data);
      break;
  }
};

/**
 * Called upon a server event.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onevent = function (packet) {
  var args = packet.data || [];
  debug('emitting event %j', args);

  if (null != packet.id) {
    debug('attaching ack callback to event');
    args.push(this.ack(packet.id));
  }

  if (this.connected) {
    emit.apply(this, args);
  } else {
    this.receiveBuffer.push(args);
  }
};

/**
 * Produces an ack callback to emit with an event.
 *
 * @api private
 */

Socket.prototype.ack = function (id) {
  var self = this;
  var sent = false;
  return function () {
    // prevent double callbacks
    if (sent) return;
    sent = true;
    var args = toArray(arguments);
    debug('sending ack %j', args);

    self.packet({
      type: hasBin(args) ? parser.BINARY_ACK : parser.ACK,
      id: id,
      data: args
    });
  };
};

/**
 * Called upon a server acknowlegement.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onack = function (packet) {
  var ack = this.acks[packet.id];
  if ('function' === typeof ack) {
    debug('calling ack %s with %j', packet.id, packet.data);
    ack.apply(this, packet.data);
    delete this.acks[packet.id];
  } else {
    debug('bad ack %s', packet.id);
  }
};

/**
 * Called upon server connect.
 *
 * @api private
 */

Socket.prototype.onconnect = function () {
  this.connected = true;
  this.disconnected = false;
  this.emit('connect');
  this.emitBuffered();
};

/**
 * Emit buffered events (received and emitted).
 *
 * @api private
 */

Socket.prototype.emitBuffered = function () {
  var i;
  for (i = 0; i < this.receiveBuffer.length; i++) {
    emit.apply(this, this.receiveBuffer[i]);
  }
  this.receiveBuffer = [];

  for (i = 0; i < this.sendBuffer.length; i++) {
    this.packet(this.sendBuffer[i]);
  }
  this.sendBuffer = [];
};

/**
 * Called upon server disconnect.
 *
 * @api private
 */

Socket.prototype.ondisconnect = function () {
  debug('server disconnect (%s)', this.nsp);
  this.destroy();
  this.onclose('io server disconnect');
};

/**
 * Called upon forced client/server side disconnections,
 * this method ensures the manager stops tracking us and
 * that reconnections don't get triggered for this.
 *
 * @api private.
 */

Socket.prototype.destroy = function () {
  if (this.subs) {
    // clean subscriptions to avoid reconnections
    for (var i = 0; i < this.subs.length; i++) {
      this.subs[i].destroy();
    }
    this.subs = null;
  }

  this.io.destroy(this);
};

/**
 * Disconnects the socket manually.
 *
 * @return {Socket} self
 * @api public
 */

Socket.prototype.close =
Socket.prototype.disconnect = function () {
  if (this.connected) {
    debug('performing disconnect (%s)', this.nsp);
    this.packet({ type: parser.DISCONNECT });
  }

  // remove socket from pool
  this.destroy();

  if (this.connected) {
    // fire events
    this.onclose('io client disconnect');
  }
  return this;
};

/**
 * Sets the compress flag.
 *
 * @param {Boolean} if `true`, compresses the sending data
 * @return {Socket} self
 * @api public
 */

Socket.prototype.compress = function (compress) {
  this.flags.compress = compress;
  return this;
};

/**
 * Sets the binary flag
 *
 * @param {Boolean} whether the emitted data contains binary
 * @return {Socket} self
 * @api public
 */

Socket.prototype.binary = function (binary) {
  this.flags.binary = binary;
  return this;
};

},{"./on":72,"component-bind":33,"component-emitter":34,"debug":75,"has-binary2":59,"parseqs":68,"socket.io-parser":79,"to-array":84}],74:[function(require,module,exports){
(function (global){

/**
 * Module dependencies.
 */

var parseuri = require('parseuri');
var debug = require('debug')('socket.io-client:url');

/**
 * Module exports.
 */

module.exports = url;

/**
 * URL parser.
 *
 * @param {String} url
 * @param {Object} An object meant to mimic window.location.
 *                 Defaults to window.location.
 * @api public
 */

function url (uri, loc) {
  var obj = uri;

  // default to window.location
  loc = loc || global.location;
  if (null == uri) uri = loc.protocol + '//' + loc.host;

  // relative path support
  if ('string' === typeof uri) {
    if ('/' === uri.charAt(0)) {
      if ('/' === uri.charAt(1)) {
        uri = loc.protocol + uri;
      } else {
        uri = loc.host + uri;
      }
    }

    if (!/^(https?|wss?):\/\//.test(uri)) {
      debug('protocol-less url %s', uri);
      if ('undefined' !== typeof loc) {
        uri = loc.protocol + '//' + uri;
      } else {
        uri = 'https://' + uri;
      }
    }

    // parse
    debug('parse %s', uri);
    obj = parseuri(uri);
  }

  // make sure we treat `localhost:80` and `localhost` equally
  if (!obj.port) {
    if (/^(http|ws)$/.test(obj.protocol)) {
      obj.port = '80';
    } else if (/^(http|ws)s$/.test(obj.protocol)) {
      obj.port = '443';
    }
  }

  obj.path = obj.path || '/';

  var ipv6 = obj.host.indexOf(':') !== -1;
  var host = ipv6 ? '[' + obj.host + ']' : obj.host;

  // define unique id
  obj.id = obj.protocol + '://' + host + ':' + obj.port;
  // define href
  obj.href = obj.protocol + '://' + host + (loc && loc.port === obj.port ? '' : (':' + obj.port));

  return obj;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"debug":75,"parseuri":69}],75:[function(require,module,exports){
arguments[4][54][0].apply(exports,arguments)
},{"./debug":76,"_process":7,"dup":54}],76:[function(require,module,exports){
arguments[4][55][0].apply(exports,arguments)
},{"dup":55,"ms":64}],77:[function(require,module,exports){

var msgpack = require('notepack.io');
var Emitter = require('component-emitter');

/**
 * Packet types (see https://github.com/socketio/socket.io-protocol)
 */

exports.CONNECT = 0;
exports.DISCONNECT = 1;
exports.EVENT = 2;
exports.ACK = 3;
exports.ERROR = 4;
exports.BINARY_EVENT = 5;
exports.BINARY_ACK = 6;

var errorPacket = {
  type: exports.ERROR,
  data: 'parser error'
};

function Encoder () {}

Encoder.prototype.encode = function (packet, callback) {
  switch (packet.type) {
    case exports.CONNECT:
    case exports.DISCONNECT:
    case exports.ERROR:
      return callback([ JSON.stringify(packet) ]);
    default:
      return callback([ msgpack.encode(packet) ]);
  }
};

function Decoder () {}

Emitter(Decoder.prototype);

Decoder.prototype.add = function (obj) {
  if (typeof obj === 'string') {
    this.parseJSON(obj);
  } else {
    this.parseBinary(obj);
  }
};

Decoder.prototype.parseJSON = function (obj) {
  try {
    var decoded = JSON.parse(obj);
    this.emit('decoded', decoded);
  } catch (e) {
    this.emit('decoded', errorPacket);
  }
};

Decoder.prototype.parseBinary = function (obj) {
  try {
    var decoded = msgpack.decode(obj);
    this.emit('decoded', decoded);
  } catch (e) {
    this.emit('decoded', errorPacket);
  }
};

Decoder.prototype.destroy = function () {};

exports.Encoder = Encoder;
exports.Decoder = Decoder;

},{"component-emitter":34,"notepack.io":67}],78:[function(require,module,exports){
(function (global){
/*global Blob,File*/

/**
 * Module requirements
 */

var isArray = require('isarray');
var isBuf = require('./is-buffer');
var toString = Object.prototype.toString;
var withNativeBlob = typeof global.Blob === 'function' || toString.call(global.Blob) === '[object BlobConstructor]';
var withNativeFile = typeof global.File === 'function' || toString.call(global.File) === '[object FileConstructor]';

/**
 * Replaces every Buffer | ArrayBuffer in packet with a numbered placeholder.
 * Anything with blobs or files should be fed through removeBlobs before coming
 * here.
 *
 * @param {Object} packet - socket.io event packet
 * @return {Object} with deconstructed packet and list of buffers
 * @api public
 */

exports.deconstructPacket = function(packet) {
  var buffers = [];
  var packetData = packet.data;
  var pack = packet;
  pack.data = _deconstructPacket(packetData, buffers);
  pack.attachments = buffers.length; // number of binary 'attachments'
  return {packet: pack, buffers: buffers};
};

function _deconstructPacket(data, buffers) {
  if (!data) return data;

  if (isBuf(data)) {
    var placeholder = { _placeholder: true, num: buffers.length };
    buffers.push(data);
    return placeholder;
  } else if (isArray(data)) {
    var newData = new Array(data.length);
    for (var i = 0; i < data.length; i++) {
      newData[i] = _deconstructPacket(data[i], buffers);
    }
    return newData;
  } else if (typeof data === 'object' && !(data instanceof Date)) {
    var newData = {};
    for (var key in data) {
      newData[key] = _deconstructPacket(data[key], buffers);
    }
    return newData;
  }
  return data;
}

/**
 * Reconstructs a binary packet from its placeholder packet and buffers
 *
 * @param {Object} packet - event packet with placeholders
 * @param {Array} buffers - binary buffers to put in placeholder positions
 * @return {Object} reconstructed packet
 * @api public
 */

exports.reconstructPacket = function(packet, buffers) {
  packet.data = _reconstructPacket(packet.data, buffers);
  packet.attachments = undefined; // no longer useful
  return packet;
};

function _reconstructPacket(data, buffers) {
  if (!data) return data;

  if (data && data._placeholder) {
    return buffers[data.num]; // appropriate buffer (should be natural order anyway)
  } else if (isArray(data)) {
    for (var i = 0; i < data.length; i++) {
      data[i] = _reconstructPacket(data[i], buffers);
    }
  } else if (typeof data === 'object') {
    for (var key in data) {
      data[key] = _reconstructPacket(data[key], buffers);
    }
  }

  return data;
}

/**
 * Asynchronously removes Blobs or Files from data via
 * FileReader's readAsArrayBuffer method. Used before encoding
 * data as msgpack. Calls callback with the blobless data.
 *
 * @param {Object} data
 * @param {Function} callback
 * @api private
 */

exports.removeBlobs = function(data, callback) {
  function _removeBlobs(obj, curKey, containingObject) {
    if (!obj) return obj;

    // convert any blob
    if ((withNativeBlob && obj instanceof Blob) ||
        (withNativeFile && obj instanceof File)) {
      pendingBlobs++;

      // async filereader
      var fileReader = new FileReader();
      fileReader.onload = function() { // this.result == arraybuffer
        if (containingObject) {
          containingObject[curKey] = this.result;
        }
        else {
          bloblessData = this.result;
        }

        // if nothing pending its callback time
        if(! --pendingBlobs) {
          callback(bloblessData);
        }
      };

      fileReader.readAsArrayBuffer(obj); // blob -> arraybuffer
    } else if (isArray(obj)) { // handle array
      for (var i = 0; i < obj.length; i++) {
        _removeBlobs(obj[i], i, obj);
      }
    } else if (typeof obj === 'object' && !isBuf(obj)) { // and object
      for (var key in obj) {
        _removeBlobs(obj[key], key, obj);
      }
    }
  }

  var pendingBlobs = 0;
  var bloblessData = data;
  _removeBlobs(bloblessData);
  if (!pendingBlobs) {
    callback(bloblessData);
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./is-buffer":80,"isarray":83}],79:[function(require,module,exports){

/**
 * Module dependencies.
 */

var debug = require('debug')('socket.io-parser');
var Emitter = require('component-emitter');
var binary = require('./binary');
var isArray = require('isarray');
var isBuf = require('./is-buffer');

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = 4;

/**
 * Packet types.
 *
 * @api public
 */

exports.types = [
  'CONNECT',
  'DISCONNECT',
  'EVENT',
  'ACK',
  'ERROR',
  'BINARY_EVENT',
  'BINARY_ACK'
];

/**
 * Packet type `connect`.
 *
 * @api public
 */

exports.CONNECT = 0;

/**
 * Packet type `disconnect`.
 *
 * @api public
 */

exports.DISCONNECT = 1;

/**
 * Packet type `event`.
 *
 * @api public
 */

exports.EVENT = 2;

/**
 * Packet type `ack`.
 *
 * @api public
 */

exports.ACK = 3;

/**
 * Packet type `error`.
 *
 * @api public
 */

exports.ERROR = 4;

/**
 * Packet type 'binary event'
 *
 * @api public
 */

exports.BINARY_EVENT = 5;

/**
 * Packet type `binary ack`. For acks with binary arguments.
 *
 * @api public
 */

exports.BINARY_ACK = 6;

/**
 * Encoder constructor.
 *
 * @api public
 */

exports.Encoder = Encoder;

/**
 * Decoder constructor.
 *
 * @api public
 */

exports.Decoder = Decoder;

/**
 * A socket.io Encoder instance
 *
 * @api public
 */

function Encoder() {}

var ERROR_PACKET = exports.ERROR + '"encode error"';

/**
 * Encode a packet as a single string if non-binary, or as a
 * buffer sequence, depending on packet type.
 *
 * @param {Object} obj - packet object
 * @param {Function} callback - function to handle encodings (likely engine.write)
 * @return Calls callback with Array of encodings
 * @api public
 */

Encoder.prototype.encode = function(obj, callback){
  debug('encoding packet %j', obj);

  if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
    encodeAsBinary(obj, callback);
  } else {
    var encoding = encodeAsString(obj);
    callback([encoding]);
  }
};

/**
 * Encode packet as string.
 *
 * @param {Object} packet
 * @return {String} encoded
 * @api private
 */

function encodeAsString(obj) {

  // first is type
  var str = '' + obj.type;

  // attachments if we have them
  if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
    str += obj.attachments + '-';
  }

  // if we have a namespace other than `/`
  // we append it followed by a comma `,`
  if (obj.nsp && '/' !== obj.nsp) {
    str += obj.nsp + ',';
  }

  // immediately followed by the id
  if (null != obj.id) {
    str += obj.id;
  }

  // json data
  if (null != obj.data) {
    var payload = tryStringify(obj.data);
    if (payload !== false) {
      str += payload;
    } else {
      return ERROR_PACKET;
    }
  }

  debug('encoded %j as %s', obj, str);
  return str;
}

function tryStringify(str) {
  try {
    return JSON.stringify(str);
  } catch(e){
    return false;
  }
}

/**
 * Encode packet as 'buffer sequence' by removing blobs, and
 * deconstructing packet into object with placeholders and
 * a list of buffers.
 *
 * @param {Object} packet
 * @return {Buffer} encoded
 * @api private
 */

function encodeAsBinary(obj, callback) {

  function writeEncoding(bloblessData) {
    var deconstruction = binary.deconstructPacket(bloblessData);
    var pack = encodeAsString(deconstruction.packet);
    var buffers = deconstruction.buffers;

    buffers.unshift(pack); // add packet info to beginning of data list
    callback(buffers); // write all the buffers
  }

  binary.removeBlobs(obj, writeEncoding);
}

/**
 * A socket.io Decoder instance
 *
 * @return {Object} decoder
 * @api public
 */

function Decoder() {
  this.reconstructor = null;
}

/**
 * Mix in `Emitter` with Decoder.
 */

Emitter(Decoder.prototype);

/**
 * Decodes an ecoded packet string into packet JSON.
 *
 * @param {String} obj - encoded packet
 * @return {Object} packet
 * @api public
 */

Decoder.prototype.add = function(obj) {
  var packet;
  if (typeof obj === 'string') {
    packet = decodeString(obj);
    if (exports.BINARY_EVENT === packet.type || exports.BINARY_ACK === packet.type) { // binary packet's json
      this.reconstructor = new BinaryReconstructor(packet);

      // no attachments, labeled binary but no binary data to follow
      if (this.reconstructor.reconPack.attachments === 0) {
        this.emit('decoded', packet);
      }
    } else { // non-binary full packet
      this.emit('decoded', packet);
    }
  }
  else if (isBuf(obj) || obj.base64) { // raw binary data
    if (!this.reconstructor) {
      throw new Error('got binary data when not reconstructing a packet');
    } else {
      packet = this.reconstructor.takeBinaryData(obj);
      if (packet) { // received final buffer
        this.reconstructor = null;
        this.emit('decoded', packet);
      }
    }
  }
  else {
    throw new Error('Unknown type: ' + obj);
  }
};

/**
 * Decode a packet String (JSON data)
 *
 * @param {String} str
 * @return {Object} packet
 * @api private
 */

function decodeString(str) {
  var i = 0;
  // look up type
  var p = {
    type: Number(str.charAt(0))
  };

  if (null == exports.types[p.type]) {
    return error('unknown packet type ' + p.type);
  }

  // look up attachments if type binary
  if (exports.BINARY_EVENT === p.type || exports.BINARY_ACK === p.type) {
    var buf = '';
    while (str.charAt(++i) !== '-') {
      buf += str.charAt(i);
      if (i == str.length) break;
    }
    if (buf != Number(buf) || str.charAt(i) !== '-') {
      throw new Error('Illegal attachments');
    }
    p.attachments = Number(buf);
  }

  // look up namespace (if any)
  if ('/' === str.charAt(i + 1)) {
    p.nsp = '';
    while (++i) {
      var c = str.charAt(i);
      if (',' === c) break;
      p.nsp += c;
      if (i === str.length) break;
    }
  } else {
    p.nsp = '/';
  }

  // look up id
  var next = str.charAt(i + 1);
  if ('' !== next && Number(next) == next) {
    p.id = '';
    while (++i) {
      var c = str.charAt(i);
      if (null == c || Number(c) != c) {
        --i;
        break;
      }
      p.id += str.charAt(i);
      if (i === str.length) break;
    }
    p.id = Number(p.id);
  }

  // look up json data
  if (str.charAt(++i)) {
    var payload = tryParse(str.substr(i));
    var isPayloadValid = payload !== false && (p.type === exports.ERROR || isArray(payload));
    if (isPayloadValid) {
      p.data = payload;
    } else {
      return error('invalid payload');
    }
  }

  debug('decoded %s as %j', str, p);
  return p;
}

function tryParse(str) {
  try {
    return JSON.parse(str);
  } catch(e){
    return false;
  }
}

/**
 * Deallocates a parser's resources
 *
 * @api public
 */

Decoder.prototype.destroy = function() {
  if (this.reconstructor) {
    this.reconstructor.finishedReconstruction();
  }
};

/**
 * A manager of a binary event's 'buffer sequence'. Should
 * be constructed whenever a packet of type BINARY_EVENT is
 * decoded.
 *
 * @param {Object} packet
 * @return {BinaryReconstructor} initialized reconstructor
 * @api private
 */

function BinaryReconstructor(packet) {
  this.reconPack = packet;
  this.buffers = [];
}

/**
 * Method to be called when binary data received from connection
 * after a BINARY_EVENT packet.
 *
 * @param {Buffer | ArrayBuffer} binData - the raw binary data received
 * @return {null | Object} returns null if more binary data is expected or
 *   a reconstructed packet object if all buffers have been received.
 * @api private
 */

BinaryReconstructor.prototype.takeBinaryData = function(binData) {
  this.buffers.push(binData);
  if (this.buffers.length === this.reconPack.attachments) { // done with buffer list
    var packet = binary.reconstructPacket(this.reconPack, this.buffers);
    this.finishedReconstruction();
    return packet;
  }
  return null;
};

/**
 * Cleans up binary packet reconstruction variables.
 *
 * @api private
 */

BinaryReconstructor.prototype.finishedReconstruction = function() {
  this.reconPack = null;
  this.buffers = [];
};

function error(msg) {
  return {
    type: exports.ERROR,
    data: 'parser error: ' + msg
  };
}

},{"./binary":78,"./is-buffer":80,"component-emitter":34,"debug":81,"isarray":83}],80:[function(require,module,exports){
(function (global){

module.exports = isBuf;

var withNativeBuffer = typeof global.Buffer === 'function' && typeof global.Buffer.isBuffer === 'function';
var withNativeArrayBuffer = typeof global.ArrayBuffer === 'function';

var isView = (function () {
  if (withNativeArrayBuffer && typeof global.ArrayBuffer.isView === 'function') {
    return global.ArrayBuffer.isView;
  } else {
    return function (obj) { return obj.buffer instanceof global.ArrayBuffer; };
  }
})();

/**
 * Returns true if obj is a buffer or an arraybuffer.
 *
 * @api private
 */

function isBuf(obj) {
  return (withNativeBuffer && global.Buffer.isBuffer(obj)) ||
          (withNativeArrayBuffer && (obj instanceof global.ArrayBuffer || isView(obj)));
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],81:[function(require,module,exports){
arguments[4][54][0].apply(exports,arguments)
},{"./debug":82,"_process":7,"dup":54}],82:[function(require,module,exports){
arguments[4][55][0].apply(exports,arguments)
},{"dup":55,"ms":64}],83:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"dup":6}],84:[function(require,module,exports){
module.exports = toArray

function toArray(list, index) {
    var array = []

    index = index || 0

    for (var i = index || 0; i < list.length; i++) {
        array[i - index] = list[i]
    }

    return array
}

},{}],85:[function(require,module,exports){
'use strict';

var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split('')
  , length = 64
  , map = {}
  , seed = 0
  , i = 0
  , prev;

/**
 * Return a string representing the specified number.
 *
 * @param {Number} num The number to convert.
 * @returns {String} The string representation of the number.
 * @api public
 */
function encode(num) {
  var encoded = '';

  do {
    encoded = alphabet[num % length] + encoded;
    num = Math.floor(num / length);
  } while (num > 0);

  return encoded;
}

/**
 * Return the integer value specified by the given string.
 *
 * @param {String} str The string to convert.
 * @returns {Number} The integer value represented by the string.
 * @api public
 */
function decode(str) {
  var decoded = 0;

  for (i = 0; i < str.length; i++) {
    decoded = decoded * length + map[str.charAt(i)];
  }

  return decoded;
}

/**
 * Yeast: A tiny growing id generator.
 *
 * @returns {String} A unique id.
 * @api public
 */
function yeast() {
  var now = encode(+new Date());

  if (now !== prev) return seed = 0, prev = now;
  return now +'.'+ encode(seed++);
}

//
// Map each character to its index.
//
for (; i < length; i++) map[alphabet[i]] = i;

//
// Expose the `yeast`, `encode` and `decode` functions.
//
yeast.encode = encode;
yeast.decode = decode;
module.exports = yeast;

},{}],86:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameWorld_1 = require("./GameWorld");
const ChunksManager_1 = require("./chunks/ChunksManager");
const UpdateCollector_1 = require("./serialize/UpdateCollector");
const DeltaTimer_1 = require("./utils/DeltaTimer");
class GameCore {
    constructor() {
        this.world = null;
        this.chunksManager = null;
        this.updateCollector = null;
        this.deltaTimer = null;
        this.chunksManager = new ChunksManager_1.ChunksManager();
        this.updateCollector = new UpdateCollector_1.UpdateCollector(this.chunksManager);
        this.world = new GameWorld_1.GameWorld(this.chunksManager);
        this.deltaTimer = new DeltaTimer_1.DeltaTimer();
    }
    gameLoop() {
        let delta = this.deltaTimer.getDelta();
        const maxDelta = 40;
        const maxDeltaLoops = 3;
        let loops = 0;
        while (delta > 0 && loops < maxDeltaLoops) {
            let loopDelta = maxDelta < delta ? maxDelta : delta;
            this.world.update(loopDelta);
            delta -= maxDelta;
            loops++;
        }
        if (delta > 0) {
            console.log("Warrning! Lost " + delta + "ms");
        }
    }
    collectUpdate() {
        return this.updateCollector.collectUpdate();
    }
    decodeUpdate(updateBuffer) {
        this.updateCollector.decodeUpdate(updateBuffer);
    }
    get ChunksManager() {
        return this.chunksManager;
    }
    get CollisionsSystem() {
        return this.world.CollisionsSystem;
    }
}
exports.GameCore = GameCore;

},{"./GameWorld":87,"./chunks/ChunksManager":90,"./serialize/UpdateCollector":120,"./utils/DeltaTimer":122}],87:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsSubscriber_1 = require("./game_utils/factory/GameObjectsSubscriber");
const CollisionsSystem_1 = require("./game_utils/physics/CollisionsSystem");
const SharedConfig_1 = require(".//SharedConfig");
class GameWorld extends GameObjectsSubscriber_1.GameObjectsSubscriber {
    // private map: Map = new Map();
    constructor(chunksManager) {
        super();
        this.collistionsSystem = new CollisionsSystem_1.CollisionsSystem();
        this.chunksManager = null;
        this.chunksManager = chunksManager;
        console.log("create game instance");
    }
    update(delta) {
        let chunk;
        let chunksIter = this.chunksManager.ChunksIterator();
        while (chunk = chunksIter.next().value) {
            for (let i = 0; i < chunk.Objects.length; i++) {
                chunk.Objects[i].update(delta);
            }
        }
        chunksIter = this.chunksManager.ChunksIterator();
        this.collistionsSystem.update();
        while (chunk = chunksIter.next().value) {
            this.collistionsSystem.updateCollisions(chunk.Objects);
        }
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.chunksManager.deactivateUnusedChunks();
        }
        this.chunksManager.rebuild();
    }
    onObjectCreate(gameObject) {
        if (gameObject.IsDestroyed) {
            return;
        }
        this.collistionsSystem.insertObject(gameObject);
    }
    onObjectDestroy(gameObject) {
        this.collistionsSystem.removeObject(gameObject);
    }
    get CollisionsSystem() {
        return this.collistionsSystem;
    }
}
exports.GameWorld = GameWorld;

},{".//SharedConfig":88,"./game_utils/factory/GameObjectsSubscriber":94,"./game_utils/physics/CollisionsSystem":111}],88:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Origin;
(function (Origin) {
    Origin[Origin["CLIENT"] = 0] = "CLIENT";
    Origin[Origin["SERVER"] = 1] = "SERVER";
    Origin[Origin["UNKNOWN"] = 2] = "UNKNOWN";
})(Origin = exports.Origin || (exports.Origin = {}));
function getOrigin() {
    if (typeof window !== 'undefined') {
        return Origin.CLIENT;
    }
    else {
        return Origin.SERVER;
    }
}
class SharedConfig {
    static get IS_SERVER() {
        return SharedConfig.ORIGIN == Origin.SERVER;
    }
    static get IS_CLIENT() {
        return SharedConfig.ORIGIN == Origin.CLIENT;
    }
}
SharedConfig.chunkSize = 32 * 40;
SharedConfig.numOfChunksX = 5;
SharedConfig.numOfChunksY = 5;
SharedConfig.chunkDeactivationTime = 1000;
SharedConfig.ORIGIN = getOrigin();
exports.SharedConfig = SharedConfig;

},{}],89:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ObjectsSerializer_1 = require("../serialize/ObjectsSerializer");
const SharedConfig_1 = require("../SharedConfig");
let fs = require('fs');
function toArrayBuffer(buffer) {
    let ab = new ArrayBuffer(buffer.length);
    let view = new Uint8Array(ab);
    for (let i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}
class Chunk {
    constructor(x, y, size) {
        this.isActive = false;
        this.dumpedBuffer = null;
        this.isNextUpdateComplete = false;
        this.x = x;
        this.y = y;
        this.size = size;
        this.objects = [];
        this.neighbors = [];
        this.leavers = [];
        this.activateTriggers = 0;
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.activate();
            this.startDeactivationTimer();
        }
        else {
            this.activate();
        }
    }
    addNeighbor(neighborChunk) {
        this.neighbors.push(neighborChunk);
    }
    addObject(gameObject) {
        this.objects.push(gameObject);
        if (SharedConfig_1.SharedConfig.IS_SERVER && gameObject.IsChunkActivateTriger) {
            this.activateTriggers++;
            // console.log("chunk " + this.Position + "activate trigers++ " + this.activateTriggers);
            this.activate();
            this.activateNeighbors();
        }
    }
    removeObject(gameObject) {
        let index = this.objects.indexOf(gameObject, 0);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
        if (gameObject.IsChunkActivateTriger) {
            this.activateTriggers--;
            // console.log("chunk " + this.Position + "activate trigers-- " + this.activateTriggers);
            if (this.activateTriggers <= 0) {
                if (!this.HasPlayersInNeighborhood) {
                    this.startDeactivationTimer();
                }
                this.deactivateNeighborsIfNoPlayers();
            }
        }
    }
    activateNeighbors() {
        for (let i = 0; i < this.neighbors.length; i++) {
            this.neighbors[i].activate();
        }
    }
    deactivateNeighborsIfNoPlayers() {
        for (let i = 0; i < this.neighbors.length; i++) {
            if (!this.neighbors[i].HasPlayersInNeighborhood) {
                this.neighbors[i].startDeactivationTimer();
            }
        }
    }
    addLeaver(gameObject) {
        this.leavers.push(gameObject);
    }
    resetLeavers() {
        this.leavers = [];
    }
    hasObject(gameObject) {
        return this.objects.indexOf(gameObject) != -1;
    }
    hasObjectInNeighborhood(gameObject) {
        if (this.hasObject(gameObject)) {
            return true;
        }
        for (let i = 0; i < this.neighbors.length; i++) {
            if (this.neighbors[i].hasObject(gameObject)) {
                return true;
            }
        }
        return false;
    }
    activate() {
        if (this.isActive) {
            this.deactivatedTime = -1;
            return;
        }
        this.isActive = true;
        this.deactivatedTime = -1;
        this.reload();
    }
    startDeactivationTimer() {
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            // console.log("start deactivation timer for chunk " + this.Position);
            this.deactivatedTime = Date.now();
        }
    }
    reload() {
        // if (!this.dumpedBuffer) {
        //     let fileName: string = "data/" + this.x + "." + this.y + ".chunk";
        //     try {
        //         let buffer: Buffer = fs.readFileSync(fileName);
        //         this.dumpedBuffer = toArrayBuffer(buffer);
        //     } catch (e) {
        //         console.log("no data file found");
        //     }
        // }
        if (this.dumpedBuffer) {
            ObjectsSerializer_1.ObjectsSerializer.deserializeChunk(this.dumpedBuffer);
        }
        // console.log("load chunk " + this.Position + " buff " + this.dumpedBuffer);
        this.dumpedBuffer = null;
    }
    deactivate() {
        if (this.dumpedBuffer || !this.isActive) {
            return;
        }
        this.clearNotPersistent();
        this.dumpedBuffer = ObjectsSerializer_1.ObjectsSerializer.serializeChunk(this);
        // let fileName: string = "data/" + this.x + "." + this.y + ".chunk";
        // fs.writeFile(fileName, new Buffer(this.dumpedBuffer), () => {});
        this.clearAll();
        this.isActive = false;
    }
    clearAll() {
        while (this.objects.length > 0) {
            this.objects[0].destroy();
        }
    }
    clearNotPersistent() {
        let numOfObjectsToBeSaved = 0;
        while (this.objects.length > numOfObjectsToBeSaved) {
            if (!(this.objects[numOfObjectsToBeSaved].IsChunkDeactivationPersistent)) {
                this.objects[numOfObjectsToBeSaved].destroy();
            }
            else {
                numOfObjectsToBeSaved++;
            }
        }
    }
    get IsNextUpdateComplete() {
        return this.isNextUpdateComplete;
    }
    set IsNextUpdateComplete(isNextUpdateComplete) {
        this.isNextUpdateComplete = isNextUpdateComplete;
    }
    get Objects() {
        return this.objects;
    }
    get HasPlayers() {
        return this.activateTriggers > 0;
    }
    get HasPlayersInNeighborhood() {
        if (this.HasPlayers) {
            return true;
        }
        for (let i = 0; i < this.neighbors.length; i++) {
            if (this.neighbors[i].HasPlayers) {
                return true;
            }
        }
        return false;
    }
    get Neighbors() {
        return this.neighbors;
    }
    get Leavers() {
        return this.leavers;
    }
    get IsActive() {
        return this.isActive;
    }
    get IsDeactivateTimePassed() {
        if (this.deactivatedTime == -1) {
            return false;
        }
        return this.TimeSinceDeactivation > SharedConfig_1.SharedConfig.chunkDeactivationTime;
    }
    get TimeSinceDeactivation() {
        return Date.now() - this.deactivatedTime;
    }
    get Position() {
        return [this.x, this.y];
    }
    get Size() {
        return this.size;
    }
}
exports.Chunk = Chunk;

},{"../SharedConfig":88,"../serialize/ObjectsSerializer":117,"fs":1}],90:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsSubscriber_1 = require("../game_utils/factory/GameObjectsSubscriber");
const SharedConfig_1 = require("../SharedConfig");
const Chunk_1 = require("./Chunk");
const ChangesDict_1 = require("../serialize/ChangesDict");
class ChunksManager extends GameObjectsSubscriber_1.GameObjectsSubscriber {
    constructor() {
        super();
        this.objectsChunks = new Map();
        this.numOfChunksX = SharedConfig_1.SharedConfig.numOfChunksX;
        this.numOfChunksY = SharedConfig_1.SharedConfig.numOfChunksY;
        this.chunkSize = SharedConfig_1.SharedConfig.chunkSize;
        this.initChunks();
        this.setChunksNeighbors();
    }
    initChunks() {
        this.chunks = [];
        for (let i = 0; i < this.numOfChunksX; i++) {
            this.chunks[i] = [];
            for (let j = 0; j < this.numOfChunksY; j++) {
                this.chunks[i][j] = new Chunk_1.Chunk(i, j, this.chunkSize);
            }
        }
    }
    setChunksNeighbors() {
        for (let i = 0; i < this.chunks.length; i++) {
            for (let j = 0; j < this.chunks.length; j++) {
                let isShifted = (i % 2) != 0;
                let isFirstInCloumn = j == 0;
                let isLastInCloumn = j == (this.numOfChunksY - 1);
                let isFirstInRow = i == 0;
                let isLastInRow = i == (this.numOfChunksX - 1);
                let neighborsMap;
                if (isShifted) {
                    neighborsMap = new Map([
                        ["U", [i, j - 1]],
                        ["UL", [i - 1, j]],
                        ["UR", [i + 1, j]],
                        ["D", [i, j + 1]],
                        ["DL", [i - 1, j + 1]],
                        ["DR", [i + 1, j + 1]]
                    ]);
                }
                else {
                    neighborsMap = new Map([
                        ["U", [i, j - 1]],
                        ["UL", [i - 1, j - 1]],
                        ["UR", [i + 1, j - 1]],
                        ["D", [i, j + 1]],
                        ["DL", [i - 1, j]],
                        ["DR", [i + 1, j]]
                    ]);
                }
                if (isFirstInRow) {
                    neighborsMap.delete("DL");
                    neighborsMap.delete("UL");
                }
                if (isLastInRow) {
                    neighborsMap.delete("DR");
                    neighborsMap.delete("UR");
                }
                if (isFirstInCloumn) {
                    neighborsMap.delete("U");
                    if (!isShifted) {
                        neighborsMap.delete("UL");
                        neighborsMap.delete("UR");
                    }
                }
                if (isLastInCloumn) {
                    neighborsMap.delete("D");
                    if (isShifted) {
                        neighborsMap.delete("DL");
                        neighborsMap.delete("DR");
                    }
                }
                neighborsMap.forEach((neighborIdx, key) => {
                    this.chunks[i][j].addNeighbor(this.chunks[neighborIdx[0]][neighborIdx[1]]);
                });
            }
        }
    }
    getChunkByCoords(x, y) {
        let idxX = Math.floor(x / this.chunkSize);
        if (idxX >= this.numOfChunksX || idxX < 0) {
            return null;
        }
        let idxY = Math.floor(y / this.chunkSize);
        if (idxX % 2) {
            if (y <= this.chunkSize * 1.5 && y >= 0) {
                idxY = 0;
            }
            else if (y < this.chunkSize * this.numOfChunksY) {
                idxY = Math.floor((y - this.chunkSize / 2) / this.chunkSize);
            }
        }
        if (idxY >= this.numOfChunksY || idxY < 0) {
            return null;
        }
        // if(SharedConfig.IS_SERVER)
        // console.log("chunk " + [idxX, idxY] + " coords " + [x, y]);
        return this.chunks[idxX][idxY];
    }
    getObjectChunk(gameObject) {
        let chunk = this.objectsChunks.get(gameObject);
        if (!chunk) {
            this.correctObjectPositionIfOutOfBounds(gameObject);
            return this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);
        }
        return this.objectsChunks.get(gameObject);
    }
    onObjectCreate(gameObject) {
        if (gameObject.IsDestroyed) {
            return;
        }
        let chunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);
        if (!chunk) {
            console.log("Created object outside chunk! " + gameObject.ID + " " + gameObject.Transform.Position);
            gameObject.destroy();
            return;
        }
        if (!chunk.IsActive && !gameObject.IsChunkActivateTriger) {
            console.log("Created not chunk activate triger object in inactive chunk! "
                + gameObject.ID + " " + [gameObject.Transform.X, gameObject.Transform.Y]);
            gameObject.destroy();
            return;
        }
        chunk.addObject(gameObject);
        this.objectsChunks.set(gameObject, chunk);
        if (gameObject.IsChunkFullUpdateTriger) {
            this.setFullUpdateForNewNeighbors(null, chunk);
        }
    }
    onObjectDestroy(gameObject) {
        this.remove(gameObject);
    }
    rebuild() {
        this.GameObjectsMapById.forEach((gameObject) => {
            this.rebuildOne(gameObject);
        });
    }
    correctObjectPositionIfOutOfBounds(gameObject) {
        if (gameObject.Transform.X <= 0) {
            gameObject.Transform.X = 1;
        }
        if (gameObject.Transform.X >= this.numOfChunksX * this.chunkSize) {
            gameObject.Transform.X = this.numOfChunksX * this.chunkSize - 1;
        }
        if (gameObject.Transform.Y <= 0) {
            gameObject.Transform.Y = 1;
        }
        if (gameObject.Transform.Y >= this.numOfChunksY * this.chunkSize) {
            gameObject.Transform.Y = this.numOfChunksY * this.chunkSize - 1;
        }
    }
    rebuildOne(gameObject) {
        if ((!gameObject.Transform.hasChange(ChangesDict_1.ChangesDict.X) && !gameObject.Transform.hasChange(ChangesDict_1.ChangesDict.Y))) {
            //chunk cannot change if object did not move
            return;
        }
        let newChunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);
        let oldChunk = this.objectsChunks.get(gameObject);
        if (!newChunk) {
            this.correctObjectPositionIfOutOfBounds(gameObject);
            newChunk = this.getChunkByCoords(gameObject.Transform.X, gameObject.Transform.Y);
        }
        if (!newChunk.IsActive && !gameObject.IsChunkActivateTriger) {
            console.log("Object went outside active chunk! " + gameObject.ID);
            oldChunk.addLeaver(gameObject);
            gameObject.destroy();
            return;
        }
        if (oldChunk == newChunk) {
            return;
        }
        if (gameObject.IsChunkFullUpdateTriger) {
            this.setFullUpdateForNewNeighbors(oldChunk, newChunk);
        }
        oldChunk.removeObject(gameObject);
        oldChunk.addLeaver(gameObject);
        newChunk.addObject(gameObject);
        this.objectsChunks.set(gameObject, newChunk);
        gameObject.forceCompleteUpdate();
    }
    setFullUpdateForNewNeighbors(oldChunk, newChunk) {
        //need to clone newNeighbors, because it could be modified
        let newNeighbors = Object.assign([], newChunk.Neighbors);
        if (oldChunk) {
            let oldNeighbors = oldChunk.Neighbors;
            let oldInNewIdx = newNeighbors.indexOf(oldChunk);
            if (oldInNewIdx != -1) {
                newNeighbors.splice(oldInNewIdx, 1);
            }
            for (let i = 0; i < oldNeighbors.length; i++) {
                let oldInNewIdx = newNeighbors.indexOf(oldNeighbors[i]);
                if (oldInNewIdx != -1) {
                    newNeighbors.splice(oldInNewIdx, 1);
                }
            }
        }
        else {
            newChunk.IsNextUpdateComplete = true;
        }
        for (let i = 0; i < newNeighbors.length; i++) {
            newNeighbors[i].IsNextUpdateComplete = true;
        }
    }
    deactivateUnusedChunks() {
        for (let chunk of this.ChunksIterator()) {
            if (chunk.IsDeactivateTimePassed && chunk.IsActive) {
                chunk.deactivate();
            }
        }
    }
    remove(gameObject) {
        if (this.objectsChunks.has(gameObject)) {
            this.objectsChunks.get(gameObject).removeObject(gameObject);
            this.objectsChunks.delete(gameObject);
        }
    }
    *ChunksIterator() {
        for (let i = 0; i < this.chunks.length; i++) {
            for (let j = 0; j < this.chunks.length; j++) {
                yield this.chunks[i][j];
            }
        }
    }
    get Chunks() {
        return this.chunks;
    }
}
exports.ChunksManager = ChunksManager;

},{"../SharedConfig":88,"../game_utils/factory/GameObjectsSubscriber":94,"../serialize/ChangesDict":116,"./Chunk":89}],91:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ResourcesMap {
    static RegisterResource(name) {
        ResourcesMap.NameToId.set(name, this.shortIdCounter);
        ResourcesMap.IdToName.set(this.shortIdCounter++, name);
    }
}
ResourcesMap.NameToId = new Map();
ResourcesMap.IdToName = new Map();
ResourcesMap.shortIdCounter = 0;
exports.ResourcesMap = ResourcesMap;
ResourcesMap.RegisterResource('none');
ResourcesMap.RegisterResource('wall');
ResourcesMap.RegisterResource('bunny');
ResourcesMap.RegisterResource('dyzma');
ResourcesMap.RegisterResource('kamis');
ResourcesMap.RegisterResource('michau');
ResourcesMap.RegisterResource('panda');
ResourcesMap.RegisterResource('bullet');
ResourcesMap.RegisterResource('fireball');
ResourcesMap.RegisterResource('bluebolt');
ResourcesMap.RegisterResource('hp_potion');
ResourcesMap.RegisterResource('portal');
ResourcesMap.RegisterResource('white');
ResourcesMap.RegisterResource('flame');
ResourcesMap.RegisterResource('template');
ResourcesMap.RegisterResource('terrain');
ResourcesMap.RegisterResource('doors_closed');
ResourcesMap.RegisterResource('doors_open');

},{}],92:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Obstacle_1 = require("../game/objects/Obstacle");
const Item_1 = require("../game/objects/Item");
const Player_1 = require("../game/objects/Player");
const FireBall_1 = require("../game/objects/FireBall");
const Enemy_1 = require("../game/objects/Enemy");
const Portal_1 = require("../game/objects/Portal");
const Doors_1 = require("../game/objects/Doors");
const PlatformTriggerTest_1 = require("../game/objects/PlatformTriggerTest");
class Prefabs {
    static Register(name, gameObjectType, prefabOptions) {
        let shortId;
        shortId = String.fromCharCode(Prefabs.shortIdCounter++);
        Prefabs.PrefabsNameToTypes.set(name, gameObjectType);
        Prefabs.PrefabsNameToId.set(name, shortId);
        Prefabs.IdToPrefabNames.set(shortId, name);
        Prefabs.PrefabsOptions.set(name, prefabOptions);
    }
}
Prefabs.PrefabsNameToId = new Map();
Prefabs.IdToPrefabNames = new Map();
Prefabs.PrefabsNameToTypes = new Map();
Prefabs.PrefabsOptions = new Map();
Prefabs.shortIdCounter = 65;
exports.Prefabs = Prefabs;
Prefabs.Register("DefaultPlayer", Player_1.Player, { spriteName: "template" });
Prefabs.Register("Michau", Enemy_1.Enemy, { spriteName: "template", name: "Michau", prefabSize: [32, 32] });
Prefabs.Register("Wall", Obstacle_1.Obstacle, { spriteName: "wall" });
Prefabs.Register("HpPotion", Item_1.Item, { spriteName: "hp_potion" });
Prefabs.Register("Doors", Doors_1.Doors, { spriteName: "doors_closed" });
Prefabs.Register("FireBall", FireBall_1.FireBall, { spriteName: "flame", prefabSize: 15 });
Prefabs.Register("Portal", Portal_1.Portal, { spriteName: "portal", prefabSize: 75 });
Prefabs.Register("PlatformTriggerTest", PlatformTriggerTest_1.PlatformTriggerTest, { prefabSize: [100, 100] });

},{"../game/objects/Doors":97,"../game/objects/Enemy":98,"../game/objects/FireBall":99,"../game/objects/Item":101,"../game/objects/Obstacle":102,"../game/objects/PlatformTriggerTest":103,"../game/objects/Player":104,"../game/objects/Portal":105}],93:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var GameObjectsManager;
(function (GameObjectsManager) {
    GameObjectsManager.gameObjectsMapById = new Map();
    function GetGameObjectById(id) {
        return GameObjectsManager.gameObjectsMapById.get(id);
    }
    GameObjectsManager.GetGameObjectById = GetGameObjectById;
    function DestroyGameObjectById(id) {
        let gameObject = GameObjectsManager.gameObjectsMapById.get(id);
        if (gameObject) {
            gameObject.destroy();
            return true;
        }
        return false;
    }
    GameObjectsManager.DestroyGameObjectById = DestroyGameObjectById;
})(GameObjectsManager = exports.GameObjectsManager || (exports.GameObjectsManager = {}));

},{}],94:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ObjectsFactory_1 = require("./ObjectsFactory");
const GameObjectsManager_1 = require("./GameObjectsManager");
class GameObjectsSubscriber {
    constructor() {
        ObjectsFactory_1.GameObjectsFactory.CreateCallbacks.push(this.onObjectCreate.bind(this));
        ObjectsFactory_1.GameObjectsFactory.DestroyCallbacks.push(this.onObjectDestroy.bind(this));
    }
    onObjectCreate(gameObject) {
    }
    onObjectDestroy(gameObject) {
    }
    get GameObjectsMapById() {
        return GameObjectsManager_1.GameObjectsManager.gameObjectsMapById;
    }
    getGameObject(id) {
        return GameObjectsManager_1.GameObjectsManager.GetGameObjectById(id);
    }
}
exports.GameObjectsSubscriber = GameObjectsSubscriber;

},{"./GameObjectsManager":93,"./ObjectsFactory":95}],95:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Transform_1 = require("../physics/Transform");
const GameObjectPrefabs_1 = require("./GameObjectPrefabs");
const GameObjectsManager_1 = require("./GameObjectsManager");
class GameObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }
    static setOptions(object, prefabOptions) {
        for (let option in prefabOptions) {
            if (option == "prefabSize")
                continue;
            if (!object.hasOwnProperty(option)) {
                throw name + " does not have property " + option;
            }
            object[option] = prefabOptions[option];
        }
    }
    static InstatiateWithPosition(prefabName, position, size, id, data) {
        let gameObject;
        let prefabOptions = GameObjectPrefabs_1.Prefabs.PrefabsOptions.get(prefabName);
        if (!size && prefabOptions && prefabOptions.prefabSize) {
            size = prefabOptions.prefabSize;
        }
        let transform = new Transform_1.Transform(position, size);
        gameObject = new (GameObjectPrefabs_1.Prefabs.PrefabsNameToTypes.get(prefabName))(transform);
        if (prefabOptions) {
            GameObjectsFactory.setOptions(gameObject, prefabOptions);
        }
        if (id) {
            gameObject.ID = id;
        }
        else {
            gameObject.ID = GameObjectPrefabs_1.Prefabs.PrefabsNameToId.get(prefabName) + (GameObjectsFactory.NEXT_ID++).toString();
        }
        if (data) {
            gameObject.deserialize(data[0], data[1]);
        }
        gameObject.updateColliders();
        GameObjectsFactory.AddToListeners(gameObject);
        return gameObject;
    }
    static Instatiate(prefabName, id, data) {
        return GameObjectsFactory.InstatiateWithPosition(prefabName, [0, 0], null, id, data);
    }
    static InstatiateManually(gameObject) {
        GameObjectsFactory.AddToListeners(gameObject);
        return gameObject;
    }
    static AddToListeners(gameObject) {
        GameObjectsManager_1.GameObjectsManager.gameObjectsMapById.set(gameObject.ID, gameObject);
        GameObjectsFactory.DestroyCallbacks.forEach((callback) => {
            gameObject.addDestroyListener(callback);
        });
        gameObject.addDestroyListener(() => {
            GameObjectsManager_1.GameObjectsManager.gameObjectsMapById.delete(gameObject.ID);
        });
        GameObjectsFactory.CreateCallbacks.forEach((callback) => {
            if (gameObject.IsDestroyed) {
                //do not call create callbacks if game object is destroyed during creation!
                return;
            }
            callback(gameObject);
        });
    }
}
GameObjectsFactory.NEXT_ID = 0;
GameObjectsFactory.CreateCallbacks = [];
GameObjectsFactory.DestroyCallbacks = [];
exports.GameObjectsFactory = GameObjectsFactory;

},{"../physics/Transform":112,"./GameObjectPrefabs":92,"./GameObjectsManager":93}],96:[function(require,module,exports){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const ChangesDict_1 = require("../../../serialize/ChangesDict");
const SerializeDecorators_1 = require("../../../serialize/SerializeDecorators");
const Serializable_1 = require("../../../serialize/Serializable");
class Actor extends GameObject_1.GameObject {
    constructor(transform) {
        super(transform);
        this.horizontal = 0;
        this.vertical = 0;
        this.weapon = null;
        this.maxHp = 200;
        this.hp = this.maxHp;
        this.velocity = 0.3;
        this.name = "";
        this.animationType = "idle";
    }
    updatePosition(delta) {
        let moveFactors = this.parseMoveDir();
        if (moveFactors[0] != 0) {
            this.Transform.X += moveFactors[0] * this.velocity * delta;
            this.Transform.addChange(ChangesDict_1.ChangesDict.X);
        }
        if (moveFactors[1] != 0) {
            this.Transform.Y += moveFactors[1] * this.velocity * delta;
            this.Transform.addChange(ChangesDict_1.ChangesDict.Y);
        }
    }
    sharedOnCollisionStay(collision) {
        super.sharedOnCollisionStay(collision);
        let gameObject = collision.ColliderB.Parent;
        if (gameObject.IsSolid) {
            this.Transform.X -= collision.Result.overlap * collision.Result.overlap_x;
            this.Transform.Y -= collision.Result.overlap * collision.Result.overlap_y;
        }
    }
    hit(power) {
        this.hp -= power;
        if (this.hp < 0) {
            this.hp = 0;
        }
        this.addChange(ChangesDict_1.ChangesDict.HP);
    }
    heal(power) {
        this.hp += power;
        if (this.hp > this.maxHp) {
            this.hp = this.maxHp;
        }
        this.addChange(ChangesDict_1.ChangesDict.HP);
    }
    parseMoveDir() {
        let speed = 0;
        if (this.horizontal != 0 && this.vertical != 0) {
            speed = 0.7071;
        }
        else if (this.horizontal != 0 || this.vertical != 0) {
            speed = 1;
        }
        return [speed * this.vertical, speed * this.horizontal];
    }
    get MaxHP() {
        return this.maxHp;
    }
    get HP() {
        return this.hp;
    }
    get Name() {
        return this.name;
    }
    set Name(name) {
        this.name = name;
        this.addChange(ChangesDict_1.ChangesDict.NAME);
    }
    set Horizontal(horizontal) {
        if (this.horizontal == horizontal)
            return;
        this.horizontal = horizontal;
        this.addChange(ChangesDict_1.ChangesDict.HORIZONTAL);
        this.setAnimationType();
    }
    set Vertical(vertical) {
        if (this.vertical == vertical)
            return;
        this.vertical = vertical;
        this.addChange(ChangesDict_1.ChangesDict.VERTICAL);
        this.setAnimationType();
    }
    setAnimationType() {
        if (this.horizontal != 0 || this.vertical != 0) {
            this.animationType = "run";
            this.addChange(ChangesDict_1.ChangesDict.ANIMATION_TYPE);
        }
        else {
            this.animationType = "idle";
            this.addChange(ChangesDict_1.ChangesDict.ANIMATION_TYPE);
        }
    }
    get Horizontal() {
        return this.horizontal;
    }
    get Vertical() {
        return this.vertical;
    }
    get SpriteName() {
        return this.spriteName + "_" + this.animationType;
    }
    get Weapon() {
        return this.weapon;
    }
    set SpriteName(spriteName) {
        this.spriteName = spriteName;
        this.addChange(ChangesDict_1.ChangesDict.SPRITE_ID);
    }
    set Weapon(weapon) {
        this.weapon = weapon;
    }
}
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.NAME, Serializable_1.SerializableTypes.String),
    __metadata("design:type", String)
], Actor.prototype, "name", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.MAX_HP, Serializable_1.SerializableTypes.Uint16),
    __metadata("design:type", Number)
], Actor.prototype, "maxHp", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.HP, Serializable_1.SerializableTypes.Uint16),
    __metadata("design:type", Number)
], Actor.prototype, "hp", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.ANIMATION_TYPE, Serializable_1.SerializableTypes.String),
    __metadata("design:type", String)
], Actor.prototype, "animationType", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.HORIZONTAL, Serializable_1.SerializableTypes.Int8),
    __metadata("design:type", Number)
], Actor.prototype, "horizontal", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.VERTICAL, Serializable_1.SerializableTypes.Int8),
    __metadata("design:type", Number)
], Actor.prototype, "vertical", void 0);
exports.Actor = Actor;

},{"../../../serialize/ChangesDict":116,"../../../serialize/Serializable":118,"../../../serialize/SerializeDecorators":119,"./GameObject":100}],97:[function(require,module,exports){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const SerializeDecorators_1 = require("../../../serialize/SerializeDecorators");
const Serializable_1 = require("../../../serialize/Serializable");
const ChangesDict_1 = require("../../../serialize/ChangesDict");
class Doors extends GameObject_1.GameObject {
    constructor(transform) {
        super(transform);
        this.isOpen = false;
        this.isSolid = true;
        this.isChunkDeactivationPersistent = true;
    }
    serverUpdate(delta) {
        super.serverUpdate(delta);
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
        if (this.isOpen) {
            this.SpriteName = "doors_open";
            this.isSolid = false;
        }
        else {
            this.SpriteName = "doors_closed";
            this.isSolid = true;
        }
    }
    open() {
        this.isOpen = !this.isOpen;
        this.addChange(ChangesDict_1.ChangesDict.ISOPEN);
    }
    interact() {
        this.open();
    }
    get InteractPopUpMessage() {
        return "Open";
    }
}
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.ISOPEN, Serializable_1.SerializableTypes.Uint8),
    __metadata("design:type", Boolean)
], Doors.prototype, "isOpen", void 0);
exports.Doors = Doors;

},{"../../../serialize/ChangesDict":116,"../../../serialize/Serializable":118,"../../../serialize/SerializeDecorators":119,"./GameObject":100}],98:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Actor_1 = require("./Actor");
const ChangesDict_1 = require("../../../serialize/ChangesDict");
const MagicWand_1 = require("../weapons/MagicWand");
class Enemy extends Actor_1.Actor {
    constructor(transform) {
        super(transform);
        this.timeSinceLastShot = 1000;
        this.velocity = 0.2;
        this.weapon = new MagicWand_1.MagicWand();
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
    }
    serverOnCollisionEnter(collision) {
        super.serverOnCollisionEnter(collision);
        let gameObject = collision.ColliderB.Parent;
        if (gameObject.IsSolid) {
            this.Horizontal = Math.round(Math.random() * 2) - 1;
            this.Vertical = Math.round(Math.random() * 2) - 1;
        }
    }
    serverUpdate(delta) {
        if (this.HP <= 0) {
            this.destroy();
            return;
        }
        this.timeSinceLastShot -= delta;
        if (this.timeSinceLastShot <= 0) {
            this.timeSinceLastShot = Math.random() * 2000;
            for (let i = 0; i < 1; i++) {
                let pos = [(Math.random() * 2) - 1, (Math.random() * 2) - 1];
                pos[0] += this.Transform.X;
                pos[1] += this.Transform.Y;
                this.weapon.use(this, pos, 0);
                this.Horizontal = Math.round(Math.random() * 2) - 1;
                this.Vertical = Math.round(Math.random() * 2) - 1;
            }
        }
        this.updatePosition(delta);
        this.transform.addChange(ChangesDict_1.ChangesDict.X);
        this.transform.addChange(ChangesDict_1.ChangesDict.Y);
    }
}
exports.Enemy = Enemy;

},{"../../../serialize/ChangesDict":116,"../weapons/MagicWand":107,"./Actor":96}],99:[function(require,module,exports){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const Projectile_1 = require("./Projectile");
const ChangesDict_1 = require("../../../serialize/ChangesDict");
const Actor_1 = require("./Actor");
const SerializeDecorators_1 = require("../../../serialize/SerializeDecorators");
const Serializable_1 = require("../../../serialize/Serializable");
class FireBall extends Projectile_1.Projectile {
    constructor(transform) {
        super(transform);
        this.power = 25;
        this.velocity = 1;
        this.lifeSpan = 20000;
        this.addChange(ChangesDict_1.ChangesDict.VELOCITY);
    }
    serverOnCollisionEnter(collision) {
        super.serverOnCollisionEnter(collision);
        let gameObject = collision.ColliderB.Parent;
        if (gameObject instanceof FireBall) {
            if (gameObject.owner != this.owner) {
                this.destroy();
            }
        }
        else if (gameObject instanceof Actor_1.Actor) {
            if (gameObject.ID != this.owner) {
                gameObject.hit(this.power);
                this.destroy();
            }
        }
        else if (gameObject.IsSolid) {
            this.destroy();
        }
    }
    get Power() {
        return this.power;
    }
    get Owner() {
        return this.owner;
    }
    set Owner(value) {
        this.owner = value;
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
        let sinAngle = Math.sin(this.transform.Rotation);
        let cosAngle = Math.cos(this.transform.Rotation);
        this.transform.X += cosAngle * this.velocity * delta;
        this.transform.Y += sinAngle * this.velocity * delta;
        // console.log("updateeee " + [this.transform.X, this.transform.Y]);
        // console.log("vel " + this.velocity);
    }
}
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.POWER, Serializable_1.SerializableTypes.Uint16),
    __metadata("design:type", Number)
], FireBall.prototype, "power", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.OWNER, Serializable_1.SerializableTypes.String),
    __metadata("design:type", String)
], FireBall.prototype, "owner", void 0);
exports.FireBall = FireBall;

},{"../../../serialize/ChangesDict":116,"../../../serialize/Serializable":118,"../../../serialize/SerializeDecorators":119,"./Actor":96,"./Projectile":106}],100:[function(require,module,exports){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const Transform_1 = require("../../physics/Transform");
const ChangesDict_1 = require("../../../serialize/ChangesDict");
const SharedConfig_1 = require("../../../SharedConfig");
const Serializable_1 = require("../../../serialize/Serializable");
const SerializeDecorators_1 = require("../../../serialize/SerializeDecorators");
const ResourcesMap_1 = require("../../ResourcesMap");
const Collider_1 = require("../../physics/Collider");
class GameObject extends Serializable_1.Serializable {
    constructor(transform) {
        super();
        this.id = "";
        this.velocity = 0;
        this.invisible = false;
        this.colliders = [];
        this.isDestroyed = false;
        this.isChunkActivateTriger = false;
        this.isChunkFullUpdateTriger = false;
        this.isChunkDeactivationPersistent = false;
        //if true object will not recive onCollisionEnter event
        this.isCollisionStatic = false;
        //if true objects cannot go through it
        this.isSolid = false;
        this.transform = transform;
        this.addCollider([transform.ScaleX, transform.ScaleY]);
        this.SpriteName = "none";
        this.destroyListeners = new Set();
    }
    addCollider(size) {
        let collider = new Collider_1.Collider(this, size);
        this.colliders.push(collider);
        return collider;
    }
    onCollisionEnter(collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.serverOnCollisionEnter(collision);
        }
        this.sharedOnCollisionEnter(collision);
    }
    onCollisionStay(collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.serverOnCollisionStay(collision);
        }
        this.sharedOnCollisionStay(collision);
    }
    onCollisionExit(collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.serverOnCollisionExit(collision);
        }
        this.sharedOnCollisionExit(collision);
    }
    serverOnCollisionEnter(collision) {
    }
    sharedOnCollisionEnter(collision) {
    }
    serverOnCollisionStay(collision) {
    }
    sharedOnCollisionStay(collision) {
    }
    serverOnCollisionExit(collision) {
    }
    sharedOnCollisionExit(collision) {
    }
    onTriggerEnter(collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.serverOnTriggerEnter(collision);
        }
        this.sharedOnTriggerEnter(collision);
    }
    onTriggerStay(collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.serverOnTriggerStay(collision);
        }
        this.sharedOnTriggerStay(collision);
    }
    onTriggerExit(collision) {
        if (this.IsDestroyed || collision.ColliderB.Parent.IsDestroyed) {
            return;
        }
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.serverOnTriggerExit(collision);
        }
        this.sharedOnTriggerExit(collision);
    }
    serverOnTriggerEnter(collision) {
    }
    sharedOnTriggerEnter(collision) {
    }
    serverOnTriggerStay(collision) {
    }
    sharedOnTriggerStay(collision) {
    }
    serverOnTriggerExit(collision) {
    }
    sharedOnTriggerExit(collision) {
    }
    forceCompleteUpdate() {
        this.forceComplete = true;
    }
    update(delta) {
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.serverUpdate(delta);
        }
        this.commonUpdate(delta);
        this.updateColliders();
    }
    updateColliders() {
        for (let collider of this.colliders) {
            collider.update();
        }
    }
    commonUpdate(delta) {
    }
    serverUpdate(delta) {
    }
    addDestroyListener(listener) {
        this.destroyListeners.add(listener);
    }
    removeDestroyListener(listener) {
        this.destroyListeners.delete(listener);
    }
    destroy() {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        for (let listener of this.destroyListeners) {
            listener(this);
        }
    }
    interact() {
    }
    get Transform() {
        return this.transform;
    }
    get ID() {
        return this.id;
    }
    get Velocity() {
        return this.velocity;
    }
    set Velocity(val) {
        this.velocity = val;
    }
    set ID(id) {
        this.id = id;
    }
    get SpriteName() {
        return this.spriteName;
    }
    set SpriteName(spriteName) {
        if (this.spriteName != spriteName) {
            this.spriteName = spriteName;
            this.addChange(ChangesDict_1.ChangesDict.SPRITE_ID);
        }
    }
    set SpriteId(id) {
        this.spriteName = ResourcesMap_1.ResourcesMap.IdToName.get(id);
    }
    get SpriteId() {
        return ResourcesMap_1.ResourcesMap.NameToId.get(this.spriteName);
    }
    get Invisible() {
        return this.invisible;
    }
    get IsDestroyed() {
        return this.isDestroyed;
    }
    get IsChunkActivateTriger() {
        return this.isChunkActivateTriger;
    }
    get IsChunkFullUpdateTriger() {
        return this.isChunkFullUpdateTriger;
    }
    get IsChunkDeactivationPersistent() {
        return this.isChunkDeactivationPersistent;
    }
    get IsCollisionStatic() {
        return this.isCollisionStatic;
    }
    get IsSolid() {
        return this.isSolid;
    }
    get InteractPopUpMessage() {
        return null;
    }
    get Colliders() {
        return this.colliders;
    }
}
__decorate([
    SerializeDecorators_1.SerializableObject("pos"),
    __metadata("design:type", Transform_1.Transform)
], GameObject.prototype, "transform", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.VELOCITY, Serializable_1.SerializableTypes.Float32),
    __metadata("design:type", Number)
], GameObject.prototype, "velocity", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty("INV", Serializable_1.SerializableTypes.Uint8),
    __metadata("design:type", Boolean)
], GameObject.prototype, "invisible", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.SPRITE_ID, Serializable_1.SerializableTypes.Uint16),
    __metadata("design:type", Number),
    __metadata("design:paramtypes", [Number])
], GameObject.prototype, "SpriteId", null);
exports.GameObject = GameObject;

},{"../../../SharedConfig":88,"../../../serialize/ChangesDict":116,"../../../serialize/Serializable":118,"../../../serialize/SerializeDecorators":119,"../../ResourcesMap":91,"../../physics/Collider":109,"../../physics/Transform":112}],101:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const Actor_1 = require("./Actor");
class Item extends GameObject_1.GameObject {
    constructor(transform) {
        super(transform);
    }
    serverOnCollisionEnter(collision) {
        super.serverOnCollisionEnter(collision);
        let gameObject = collision.ColliderB.Parent;
        if (gameObject instanceof Actor_1.Actor) {
            gameObject.heal(50);
        }
        this.destroy();
    }
    serverUpdate(delta) {
        super.serverUpdate(delta);
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
    }
}
exports.Item = Item;

},{"./Actor":96,"./GameObject":100}],102:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
class Obstacle extends GameObject_1.GameObject {
    constructor(transform) {
        super(transform);
        this.isCollisionStatic = true;
        this.isSolid = true;
        this.isChunkDeactivationPersistent = true;
    }
    serverUpdate(delta) {
        super.serverUpdate(delta);
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
    }
}
exports.Obstacle = Obstacle;

},{"./GameObject":100}],103:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
class PlatformTriggerTest extends GameObject_1.GameObject {
    constructor(transform) {
        super(transform);
        this.isChunkDeactivationPersistent = true;
        this.SpriteName = "none";
        let collider = this.addCollider([transform.ScaleX, transform.ScaleY]);
        collider.IsTriger = true;
    }
    serverOnTriggerEnter(collision) {
        this.SpriteName = "michau";
    }
    serverOnTriggerExit(collision) {
        this.SpriteName = "none";
    }
    serverUpdate(delta) {
        super.serverUpdate(delta);
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
    }
}
exports.PlatformTriggerTest = PlatformTriggerTest;

},{"./GameObject":100}],104:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const InputCommands_1 = require("../../../input/InputCommands");
const Actor_1 = require("./Actor");
const ChangesDict_1 = require("../../../serialize/ChangesDict");
const SharedConfig_1 = require("../../../SharedConfig");
const MagicWand_1 = require("../weapons/MagicWand");
const ObjectsSpawner_1 = require("../weapons/ObjectsSpawner");
const Doors_1 = require("./Doors");
const Enemy_1 = require("./Enemy");
class Player extends Actor_1.Actor {
    constructor(transform) {
        super(transform);
        this.lastInputSnapshot = null;
        let collider = this.addCollider([transform.ScaleX * 2, transform.ScaleY * 2]);
        collider.IsTriger = true;
        this.velocity = 0.25;
        // this.weapon = new PortalGun();
        // this.weapon = new MagicWand();
        this.weapon = new ObjectsSpawner_1.ObjectsSpawner();
        this.isChunkActivateTriger = true;
        this.isChunkFullUpdateTriger = true;
    }
    serverOnTriggerEnter(collision) {
        let gameObject = collision.ColliderB.Parent;
        if (gameObject instanceof Doors_1.Doors) {
            gameObject.open();
        }
        else if (gameObject instanceof Enemy_1.Enemy) {
            gameObject.destroy();
        }
    }
    serverOnTriggerExit(collision) {
        let gameObject = collision.ColliderB.Parent;
        if (gameObject instanceof Doors_1.Doors) {
            gameObject.open();
        }
    }
    setInput(inputSnapshot) {
        let inputCommands = inputSnapshot.Commands;
        inputCommands.forEach((value, key) => {
            if (SharedConfig_1.SharedConfig.IS_CLIENT && Player.onlyServerActions.has(key))
                return;
            if (key == InputCommands_1.INPUT_COMMAND.HORIZONTAL) {
                this.Horizontal = parseFloat(value);
                this.lastInputSnapshot = inputSnapshot;
            }
            else if (key == InputCommands_1.INPUT_COMMAND.VERTICAL) {
                this.Vertical = parseFloat(value);
                this.lastInputSnapshot = inputSnapshot;
            }
            else if (key == InputCommands_1.INPUT_COMMAND.LEFT_MOUSE) {
                this.mouseClickAction(value, InputCommands_1.MouseKeys.LEFT);
            }
            else if (key == InputCommands_1.INPUT_COMMAND.RIGHT_MOUSE) {
                this.mouseClickAction(value, InputCommands_1.MouseKeys.RIGHT);
            }
            else if (key == InputCommands_1.INPUT_COMMAND.MIDDLE_MOUSE) {
                this.mouseClickAction(value, InputCommands_1.MouseKeys.MIDDLE);
            }
            else if (key == InputCommands_1.INPUT_COMMAND.SWITCH_WEAPON) {
                this.switchWeaponAction(value);
            }
            else if (key == InputCommands_1.INPUT_COMMAND.TEST) {
                this.testAction(value);
            }
        });
    }
    mouseClickAction(position, clickButton) {
        let splited = position.split(',').map((val) => { return parseFloat(val); });
        this.weapon.use(this, [splited[0], splited[1]], clickButton);
        // for(let i = 0; i < 8; i++) {
        //     this.weapon.use(this, Math.random() * 7, clickButton);
        // }
    }
    switchWeaponAction(value) {
        if (this.weapon instanceof ObjectsSpawner_1.ObjectsSpawner) {
            this.weapon = new MagicWand_1.MagicWand();
        }
        else {
            this.weapon = new ObjectsSpawner_1.ObjectsSpawner();
        }
    }
    testAction(value) {
        // this.invisible = !this.invisible;
        // this.addChange("INV");
        this.velocity += 0.8;
        if (this.velocity > 2) {
            this.velocity = 0.25;
        }
        this.addChange(ChangesDict_1.ChangesDict.VELOCITY);
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
        if (this.lastInputSnapshot) {
            this.lastInputSnapshot.setSnapshotDelta();
        }
        this.updatePosition(delta);
    }
    serverUpdate(delta) {
        super.serverUpdate(delta);
    }
}
Player.onlyServerActions = new Set([
    InputCommands_1.INPUT_COMMAND.LEFT_MOUSE,
    InputCommands_1.INPUT_COMMAND.RIGHT_MOUSE,
    InputCommands_1.INPUT_COMMAND.MIDDLE_MOUSE,
    InputCommands_1.INPUT_COMMAND.TEST
]);
exports.Player = Player;

},{"../../../SharedConfig":88,"../../../input/InputCommands":113,"../../../serialize/ChangesDict":116,"../weapons/MagicWand":107,"../weapons/ObjectsSpawner":108,"./Actor":96,"./Doors":97,"./Enemy":98}],105:[function(require,module,exports){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const SerializeDecorators_1 = require("../../../serialize/SerializeDecorators");
const ChangesDict_1 = require("../../../serialize/ChangesDict");
const Actor_1 = require("./Actor");
const Serializable_1 = require("../../../serialize/Serializable");
class Portal extends GameObject_1.GameObject {
    constructor(transform) {
        super(transform);
        this.couplingPortal = null;
        this.isAttached = false;
        this.velocity = 2;
    }
    get IsActive() {
        if (this.couplingPortal == null) {
            return false;
        }
        if (this.couplingPortal.IsDestroyed != false) {
            this.couplingPortal = null;
            return false;
        }
        return this.isAttached && this.couplingPortal.isAttached;
    }
    serverOnCollisionEnter(collision) {
        let gameObject = collision.ColliderB.Parent;
        if (gameObject instanceof Portal) {
            this.destroy();
            return;
        }
        else if (gameObject.IsSolid) {
            this.isAttached = true;
            this.Transform.X -= collision.Result.overlap * collision.Result.overlap_x;
            this.Transform.Y -= collision.Result.overlap * collision.Result.overlap_y;
            this.transform.Rotation = gameObject.Transform.Rotation;
            this.addChange(ChangesDict_1.ChangesDict.IS_ATTACHED);
            this.Transform.addChange(ChangesDict_1.ChangesDict.X);
            this.Transform.addChange(ChangesDict_1.ChangesDict.Y);
        }
        if (this.IsActive) {
            if (gameObject instanceof Actor_1.Actor) {
                gameObject.Transform.X = this.couplingPortal.Transform.X;
                gameObject.Transform.Y = this.couplingPortal.Transform.Y;
                gameObject.Transform.addChange(ChangesDict_1.ChangesDict.X);
                gameObject.Transform.addChange(ChangesDict_1.ChangesDict.Y);
                this.couplingPortal.destroy();
                this.destroy();
            }
        }
        super.serverOnCollisionEnter(collision);
    }
    serverUpdate(delta) {
        super.serverUpdate(delta);
    }
    commonUpdate(delta) {
        if (!this.isAttached) {
            let sinAngle = Math.sin(this.transform.Rotation);
            let cosAngle = Math.cos(this.transform.Rotation);
            this.transform.X += cosAngle * this.velocity * delta;
            this.transform.Y += sinAngle * this.velocity * delta;
        }
        super.commonUpdate(delta);
    }
    set CouplingPortal(portal) {
        this.couplingPortal = portal;
    }
}
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.IS_ATTACHED, Serializable_1.SerializableTypes.Int8),
    __metadata("design:type", Boolean)
], Portal.prototype, "isAttached", void 0);
exports.Portal = Portal;

},{"../../../serialize/ChangesDict":116,"../../../serialize/Serializable":118,"../../../serialize/SerializeDecorators":119,"./Actor":96,"./GameObject":100}],106:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
class Projectile extends GameObject_1.GameObject {
    constructor() {
        super(...arguments);
        this.lifeSpan = 50;
    }
    serverUpdate(delta) {
        super.serverUpdate(delta);
        // lifeSpan == 0 -> infinite
        if (this.lifeSpan != 0) {
            if (this.lifeSpan > delta) {
                this.lifeSpan -= delta;
            }
            else {
                this.destroy();
            }
        }
    }
}
exports.Projectile = Projectile;

},{"./GameObject":100}],107:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ObjectsFactory_1 = require("../../factory/ObjectsFactory");
const CalcAngle_1 = require("../../../utils/functions/CalcAngle");
class MagicWand {
    use(user, position, clickButton) {
        let angle = CalcAngle_1.calcAngle(position, user.Transform.Position);
        let fireBall = ObjectsFactory_1.GameObjectsFactory.InstatiateWithPosition("FireBall", [user.Transform.X, user.Transform.Y]);
        fireBall.Owner = user.ID;
        fireBall.Transform.Rotation = angle;
    }
    ;
    equip() {
    }
    hide() {
    }
}
exports.MagicWand = MagicWand;

},{"../../../utils/functions/CalcAngle":125,"../../factory/ObjectsFactory":95}],108:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ObjectsFactory_1 = require("../../factory/ObjectsFactory");
const InputCommands_1 = require("../../../input/InputCommands");
class ObjectsSpawner {
    use(user, position, clickButton) {
        for (let i = 0; i < 1; i++) {
            if (clickButton == InputCommands_1.MouseKeys.LEFT) {
                let gg = ObjectsFactory_1.GameObjectsFactory.InstatiateWithPosition("Michau", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]);
                gg.Name = "Michau " + gg.ID;
            }
            else if (clickButton == InputCommands_1.MouseKeys.RIGHT) {
                ObjectsFactory_1.GameObjectsFactory.InstatiateWithPosition("Wall", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]);
            }
            else {
                // GameObjectsFactory.InstatiateWithPosition("Doors", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]);
                ObjectsFactory_1.GameObjectsFactory.InstatiateWithPosition("PlatformTriggerTest", [Math.round(position[0] / 32) * 32, Math.round(position[1] / 32) * 32]);
            }
        }
    }
    ;
    equip() {
    }
    hide() {
    }
}
exports.ObjectsSpawner = ObjectsSpawner;

},{"../../../input/InputCommands":113,"../../factory/ObjectsFactory":95}],109:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const detect_collisions_1 = require("detect-collisions");
const Collision_1 = require("./Collision");
class Collider {
    constructor(parent, size) {
        this.rotation = 0;
        //TODO use isActive!
        this.isActive = true;
        this.isTrigger = false;
        this.parent = parent;
        let x = parent.Transform.X;
        let y = parent.Transform.Y;
        this.offsetX = 0;
        this.offsetY = 0;
        let isCircle = false;
        if (!size) {
            this.width = 32;
            this.height = 32;
        }
        else if (size instanceof Array) {
            this.width = size[0];
            this.height = size[1];
        }
        else {
            this.width = size;
            this.height = size;
            isCircle = true;
        }
        if (isCircle) {
            this.shape = new detect_collisions_1.Circle(x, y, this.width);
        }
        else {
            let w = this.width / 2;
            let h = this.height / 2;
            this.shape = new detect_collisions_1.Polygon(x, y, [[-w, -h], [w, -h], [w, h], [-w, h]]);
        }
    }
    onCollisionEnter(collider, result) {
        let collision = new Collision_1.Collision(this, collider, result);
        if (this.isTrigger) {
            this.parent.onTriggerEnter(collision);
        }
        else {
            this.parent.onCollisionEnter(collision);
        }
    }
    onCollisionStay(collider, result) {
        let collision = new Collision_1.Collision(this, collider, result);
        if (this.isTrigger) {
            this.parent.onTriggerStay(collision);
        }
        else {
            this.parent.onCollisionStay(collision);
        }
    }
    onCollisionExit(collider, result) {
        let collision = new Collision_1.Collision(this, collider, result);
        if (this.isTrigger) {
            this.parent.onTriggerExit(collision);
        }
        else {
            this.parent.onCollisionExit(collision);
        }
    }
    update() {
        this.shape.x = this.parent.Transform.X + this.offsetX;
        this.shape.y = this.parent.Transform.Y + this.offsetY;
    }
    resize() {
        if (this.shape instanceof detect_collisions_1.Polygon) {
            let w = this.width / 2;
            let h = this.height / 2;
            this.shape.setPoints([[-w, -h], [w, -h], [w, h], [-w, h]]);
        }
        else { //circle
            this.shape.radius = this.width;
            this.height = this.shape.radius;
        }
    }
    set Rotation(rotation) {
        if (this.shape instanceof detect_collisions_1.Polygon) {
            this.shape.rotation = rotation;
        }
        this.rotation = rotation;
    }
    get Rotation() {
        return this.rotation;
    }
    get IsActive() {
        return this.isActive;
    }
    get Body() {
        return this.shape;
    }
    get Parent() {
        return this.parent;
    }
    get IsTrigger() {
        return this.isTrigger;
    }
    set IsActive(isActive) {
        this.isActive = isActive;
    }
    set IsTriger(isTrigger) {
        this.isTrigger = isTrigger;
    }
    set OffsetX(offset) {
        this.offsetX = offset;
    }
    set OffsetY(offset) {
        this.offsetY = offset;
    }
    isColliding() {
        let potentials = this.Body.potentials();
        for (let body of potentials) {
            if (this.Body.collides(body)) {
                return true;
            }
        }
        return false;
    }
}
exports.Collider = Collider;

},{"./Collision":110,"detect-collisions":36}],110:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Collision {
    constructor(colliderA, colliderB, result) {
        this.colliderA = colliderA;
        this.colliderB = colliderB;
        this.result = result;
    }
    get ColliderA() {
        return this.colliderA;
    }
    get ColliderB() {
        return this.colliderB;
    }
    get Result() {
        return this.result;
    }
}
exports.Collision = Collision;

},{}],111:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const detect_collisions_1 = require("detect-collisions");
const SharedConfig_1 = require("../../SharedConfig");
class CollisionsSystem extends detect_collisions_1.Collisions {
    constructor() {
        super();
        this.bodyToColliderMap = new Map();
        this.collidingBodiesMap = new Map();
        this.lastCollisionResult = new detect_collisions_1.Result();
    }
    insertObject(gameObject) {
        for (let collider of gameObject.Colliders) {
            super.insert(collider.Body);
            this.bodyToColliderMap.set(collider.Body, collider);
            this.collidingBodiesMap.set(collider.Body, new Set());
        }
        if (SharedConfig_1.SharedConfig.IS_SERVER && gameObject.IsSolid && this.isObjectColliding(gameObject)) {
            gameObject.destroy();
        }
    }
    removeObject(gameObject) {
        for (let collider of gameObject.Colliders) {
            if (this.bodyToColliderMap.has(collider.Body)) {
                super.remove(collider.Body);
                this.bodyToColliderMap.delete(collider.Body);
            }
            if (this.collidingBodiesMap.has(collider.Body)) {
                this.collidingBodiesMap.delete(collider.Body);
            }
        }
    }
    update() {
        super.update();
    }
    updateCollisions(gameObjects) {
        gameObjects.forEach((gameObject) => {
            this.updateCollisionsForGameObject(gameObject);
        });
    }
    updateCollisionsForGameObject(gameObject) {
        for (let collider of gameObject.Colliders) {
            if (gameObject.IsCollisionStatic) {
                //no need to calculate collisions for obstacles since they are not moving
                //that hack gives us huge performance boost when we have thousands of obstacles
                return;
            }
            let colliderBody = collider.Body;
            let oldCollidingBodies = this.collidingBodiesMap.get(colliderBody);
            let newCollidingBodies = new Set();
            for (let body of this.CollisionBodyIterator(colliderBody)) {
                let colidedCollider = this.bodyToColliderMap.get(body);
                if (!colidedCollider || colidedCollider == collider) {
                    continue;
                }
                if (!oldCollidingBodies.has(body)) {
                    collider.onCollisionEnter(colidedCollider, this.lastCollisionResult);
                }
                newCollidingBodies.add(body);
                collider.onCollisionStay(colidedCollider, this.lastCollisionResult);
            }
            for (let body of oldCollidingBodies) {
                if (!newCollidingBodies.has(body)) {
                    let colidedCollider = this.bodyToColliderMap.get(body);
                    if (!colidedCollider || colidedCollider == collider) {
                        continue;
                    }
                    body.collides(colidedCollider.Body, this.lastCollisionResult);
                    collider.onCollisionExit(colidedCollider, this.lastCollisionResult);
                }
            }
            this.collidingBodiesMap.set(colliderBody, newCollidingBodies);
        }
    }
    isObjectColliding(object) {
        for (let collider of object.Colliders) {
            let potentials = collider.Body.potentials();
            for (let body of potentials) {
                if (collider.Parent.ID == this.bodyToColliderMap.get(body).Parent.ID) {
                    //skip check colliders with same parent
                    continue;
                }
                if (collider.Body.collides(body)) {
                    return true;
                }
            }
        }
        return false;
    }
    *CollisionBodyIterator(objectBody) {
        for (let body of objectBody.potentials()) {
            if (objectBody.collides(body, this.lastCollisionResult)) {
                yield body;
            }
        }
    }
}
exports.CollisionsSystem = CollisionsSystem;

},{"../../SharedConfig":88,"detect-collisions":36}],112:[function(require,module,exports){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const SerializeDecorators_1 = require("../../serialize/SerializeDecorators");
const ChangesDict_1 = require("../../serialize/ChangesDict");
const Serializable_1 = require("../../serialize/Serializable");
class Transform extends Serializable_1.Serializable {
    constructor(position, size) {
        super();
        this.x = position[0];
        this.y = position[1];
        this.Rotation = 0;
        if (!size) {
            this.scaleX = 32;
            this.scaleY = 32;
        }
        else if (size instanceof Array) {
            this.scaleX = size[0];
            this.scaleY = size[1];
        }
        else {
            this.scaleX = size;
            this.scaleY = size;
        }
    }
    rotate(angle) {
        this.Rotation += angle;
    }
    distanceTo(transform) {
        return Transform.Distance(this, transform);
    }
    get X() {
        return this.x;
    }
    set X(x) {
        this.addChange(ChangesDict_1.ChangesDict.X);
        this.x = x;
    }
    get Y() {
        return this.y;
    }
    set Y(y) {
        this.addChange(ChangesDict_1.ChangesDict.Y);
        this.y = y;
    }
    set ScaleX(width) {
        if (this.scaleX == width)
            return;
        this.scaleX = width;
        this.addChange(ChangesDict_1.ChangesDict.SCALEX);
    }
    get ScaleX() {
        return this.scaleX;
    }
    set ScaleY(height) {
        if (this.scaleY == height)
            return;
        this.scaleY = height;
        this.addChange(ChangesDict_1.ChangesDict.SCALEY);
    }
    get ScaleY() {
        return this.scaleY;
    }
    get Position() {
        return [this.X, this.Y];
    }
    set Rotation(rotation) {
        this.addChange(ChangesDict_1.ChangesDict.ROTATION);
        this.rotation = rotation;
    }
    get Rotation() {
        return this.rotation;
    }
    static Distance(t1, t2) {
        return Math.sqrt(Math.pow(t1.X - t2.X, 2) + Math.pow(t1.Y - t2.Y, 2));
    }
}
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.SCALEX, Serializable_1.SerializableTypes.Uint16),
    __metadata("design:type", Number)
], Transform.prototype, "scaleX", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.SCALEY, Serializable_1.SerializableTypes.Uint16),
    __metadata("design:type", Number)
], Transform.prototype, "scaleY", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.X, Serializable_1.SerializableTypes.Float32),
    __metadata("design:type", Object)
], Transform.prototype, "x", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.Y, Serializable_1.SerializableTypes.Float32),
    __metadata("design:type", Object)
], Transform.prototype, "y", void 0);
__decorate([
    SerializeDecorators_1.SerializableProperty(ChangesDict_1.ChangesDict.ROTATION, Serializable_1.SerializableTypes.Float32),
    __metadata("design:type", Object)
], Transform.prototype, "rotation", void 0);
exports.Transform = Transform;

},{"../../serialize/ChangesDict":116,"../../serialize/Serializable":118,"../../serialize/SerializeDecorators":119}],113:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var INPUT_COMMAND;
(function (INPUT_COMMAND) {
    // MOVE_DIRECTION,
    INPUT_COMMAND[INPUT_COMMAND["UP"] = 0] = "UP";
    INPUT_COMMAND[INPUT_COMMAND["DOWN"] = 1] = "DOWN";
    INPUT_COMMAND[INPUT_COMMAND["HORIZONTAL"] = 2] = "HORIZONTAL";
    INPUT_COMMAND[INPUT_COMMAND["LEFT"] = 3] = "LEFT";
    INPUT_COMMAND[INPUT_COMMAND["RIGHT"] = 4] = "RIGHT";
    INPUT_COMMAND[INPUT_COMMAND["VERTICAL"] = 5] = "VERTICAL";
    INPUT_COMMAND[INPUT_COMMAND["LEFT_MOUSE"] = 6] = "LEFT_MOUSE";
    INPUT_COMMAND[INPUT_COMMAND["RIGHT_MOUSE"] = 7] = "RIGHT_MOUSE";
    INPUT_COMMAND[INPUT_COMMAND["MIDDLE_MOUSE"] = 8] = "MIDDLE_MOUSE";
    INPUT_COMMAND[INPUT_COMMAND["INTERACT"] = 9] = "INTERACT";
    INPUT_COMMAND[INPUT_COMMAND["SWITCH_WEAPON"] = 10] = "SWITCH_WEAPON";
    INPUT_COMMAND[INPUT_COMMAND["TEST"] = 11] = "TEST";
})(INPUT_COMMAND = exports.INPUT_COMMAND || (exports.INPUT_COMMAND = {}));
var MouseKeys;
(function (MouseKeys) {
    MouseKeys[MouseKeys["LEFT"] = 0] = "LEFT";
    MouseKeys[MouseKeys["MIDDLE"] = 1] = "MIDDLE";
    MouseKeys[MouseKeys["RIGHT"] = 2] = "RIGHT";
})(MouseKeys = exports.MouseKeys || (exports.MouseKeys = {}));

},{}],114:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const InputCommands_1 = require("../input/InputCommands");
const DeltaTimer_1 = require("../utils/DeltaTimer");
class InputSnapshot {
    constructor(serializedSnapshot) {
        this.snapshotDelta = 0;
        this.resetTime();
        this.commandList = new Map();
        if (serializedSnapshot) {
            this.deserialize(serializedSnapshot);
        }
        else {
            this.id = InputSnapshot.NextId++;
        }
    }
    append(command, value) {
        this.commandList.set(command, value);
    }
    isMoving() {
        return (this.Commands.has(InputCommands_1.INPUT_COMMAND.HORIZONTAL) && this.Commands.get(InputCommands_1.INPUT_COMMAND.HORIZONTAL) != 0) ||
            (this.Commands.has(InputCommands_1.INPUT_COMMAND.VERTICAL) && this.Commands.get(InputCommands_1.INPUT_COMMAND.VERTICAL) != 0);
    }
    serializeSnapshot() {
        let serializedSnapshot = '';
        this.commandList.forEach((value, key) => {
            serializedSnapshot += '#' + key.toString() + ':' + value;
        });
        return this.id + "=" + serializedSnapshot.slice(1);
    }
    deserialize(serializedSnapshot) {
        this.commandList.clear();
        let splited = serializedSnapshot.split("=");
        this.id = Number(splited[0]);
        let commands = splited[1].split('#');
        commands.forEach((command) => {
            let splited = command.split(':');
            this.commandList.set(Number(splited[0]), splited[1]);
        });
    }
    resetTime() {
        this.time = DeltaTimer_1.DeltaTimer.getTimestamp();
    }
    get CreateTime() {
        return this.time;
    }
    setSnapshotDelta() {
        this.snapshotDelta = Date.now() - this.time;
    }
    get SnapshotDelta() {
        return this.snapshotDelta;
    }
    get ID() {
        return this.id;
    }
    get Commands() {
        return this.commandList;
    }
}
InputSnapshot.NextId = 0;
exports.InputSnapshot = InputSnapshot;

},{"../input/InputCommands":113,"../utils/DeltaTimer":122}],115:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let messageCode = 0;
class SocketMsgs {
}
SocketMsgs.CHAT_MESSAGE = String.fromCharCode(messageCode++);
SocketMsgs.CLIENT_READY = String.fromCharCode(messageCode++);
SocketMsgs.HEARTBEAT = String.fromCharCode(messageCode++);
SocketMsgs.INPUT_SNAPSHOT = String.fromCharCode(messageCode++);
SocketMsgs.CONNECTION = 'connection';
SocketMsgs.DISCONNECT = 'disconnect';
SocketMsgs.START_GAME = String.fromCharCode(messageCode++);
SocketMsgs.INITIALIZE_GAME = String.fromCharCode(messageCode++);
SocketMsgs.FIRST_UPDATE_GAME = String.fromCharCode(messageCode++);
SocketMsgs.UPDATE_GAME = String.fromCharCode(messageCode++);
SocketMsgs.HEARTBEAT_RESPONSE = String.fromCharCode(messageCode++);
SocketMsgs.UPDATE_SNAPSHOT_DATA = String.fromCharCode(messageCode++);
SocketMsgs.CHUNK_CHANGED = String.fromCharCode(messageCode++);
SocketMsgs.ERROR = String.fromCharCode(messageCode++);
exports.SocketMsgs = SocketMsgs;

},{}],116:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ChangesDict {
}
//GameObject
ChangesDict.SPRITE_ID = "SPRITE_ID";
ChangesDict.VELOCITY = "VELOCITY";
ChangesDict.ISOPEN = "ISOPEN";
//Actor
ChangesDict.HP = "HP";
ChangesDict.MAX_HP = "MAX_HP";
ChangesDict.NAME = "NAME";
ChangesDict.ANIMATION_TYPE = "ANIMATION_TYPE";
ChangesDict.HORIZONTAL = "HORIZONTAL";
ChangesDict.VERTICAL = "VERTICAL";
//Projectile
ChangesDict.OWNER = "O";
ChangesDict.POWER = "B";
//Transform
ChangesDict.X = "X";
ChangesDict.Y = "Y";
ChangesDict.SCALEX = "SCALEX";
ChangesDict.SCALEY = "SCALEY";
ChangesDict.ROTATION = "ROTATION";
//Portal
ChangesDict.IS_ATTACHED = "IS_ATTACHED";
exports.ChangesDict = ChangesDict;

},{}],117:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ObjectsFactory_1 = require("../game_utils/factory/ObjectsFactory");
const GameObjectPrefabs_1 = require("../game_utils/factory/GameObjectPrefabs");
class ObjectsSerializer {
    static serializeObject(gameObject) {
        let objectNeededSize = gameObject.calcNeededBufferSize(true) + 5;
        let updateBuffer = new ArrayBuffer(objectNeededSize);
        let updateBufferView = new DataView(updateBuffer);
        updateBufferView.setUint8(0, gameObject.ID.charCodeAt(0));
        updateBufferView.setUint32(1, Number(gameObject.ID.slice(1)));
        gameObject.serialize(updateBufferView, 5, true);
        return updateBufferView;
    }
    static serializeChunk(chunk) {
        let chunkCompleteUpdate = true;
        let neededBufferSize = 0;
        let objectsToUpdateMap = new Map();
        chunk.Objects.forEach((gameObject) => {
            let neededSize = gameObject.calcNeededBufferSize(chunkCompleteUpdate);
            if (neededSize > 0) {
                objectsToUpdateMap.set(gameObject, neededBufferSize);
                //need 5 bits for obj ID
                neededBufferSize += neededSize + ObjectsSerializer.OBJECT_ID_BYTES_LEN;
            }
        });
        let updateBuffer = new ArrayBuffer(neededBufferSize);
        let updateBufferView = new DataView(updateBuffer);
        objectsToUpdateMap.forEach((offset, gameObject) => {
            updateBufferView.setUint8(offset, gameObject.ID.charCodeAt(0));
            updateBufferView.setUint32(offset + 1, Number(gameObject.ID.slice(1)));
            gameObject.serialize(updateBufferView, offset + ObjectsSerializer.OBJECT_ID_BYTES_LEN, chunkCompleteUpdate);
        });
        return updateBuffer;
    }
    static deserializeChunk(updateBuffer) {
        let updateBufferView = new DataView(updateBuffer);
        let offset = 0;
        while (offset < updateBufferView.byteLength) {
            let id = String.fromCharCode(updateBufferView.getUint8(offset));
            id += updateBufferView.getUint32(offset + 1).toString();
            offset += 5;
            let gameObject = ObjectsFactory_1.GameObjectsFactory.Instatiate(GameObjectPrefabs_1.Prefabs.IdToPrefabNames.get(id[0]), undefined, [updateBufferView, offset]);
            offset = gameObject.deserialize(updateBufferView, offset);
        }
    }
}
ObjectsSerializer.OBJECT_ID_BYTES_LEN = 5;
exports.ObjectsSerializer = ObjectsSerializer;

},{"../game_utils/factory/GameObjectPrefabs":92,"../game_utils/factory/ObjectsFactory":95}],118:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SerializeDecorators_1 = require("./SerializeDecorators");
const SharedConfig_1 = require("../SharedConfig");
const BitOperations_1 = require("../utils/functions/BitOperations");
const TicksCounter_1 = require("../utils/TicksCounter");
var SerializableTypes;
(function (SerializableTypes) {
    SerializableTypes[SerializableTypes["Int8"] = 0] = "Int8";
    SerializableTypes[SerializableTypes["Int16"] = 1] = "Int16";
    SerializableTypes[SerializableTypes["Int32"] = 2] = "Int32";
    SerializableTypes[SerializableTypes["Uint8"] = 3] = "Uint8";
    SerializableTypes[SerializableTypes["Uint16"] = 4] = "Uint16";
    SerializableTypes[SerializableTypes["Uint32"] = 5] = "Uint32";
    SerializableTypes[SerializableTypes["Float32"] = 6] = "Float32";
    SerializableTypes[SerializableTypes["Float64"] = 7] = "Float64";
    SerializableTypes[SerializableTypes["String"] = 8] = "String";
    SerializableTypes[SerializableTypes["Object"] = 9] = "Object";
})(SerializableTypes = exports.SerializableTypes || (exports.SerializableTypes = {}));
class Serializable {
    constructor() {
        this.lastUpdateTick = 0;
        this.changes = new Set();
        this.deserializedFields = new Set();
        this.forceComplete = true;
    }
    addChange(change) {
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.changes.add(change);
        }
    }
    hasChange(change) {
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            return this.changes.has(change);
        }
        else {
            return this.deserializedFields.has(change);
        }
    }
    calcNeededBufferSize(complete) {
        if (this.forceComplete) {
            complete = true;
        }
        let neededSize = 0;
        let propsSize = this[SerializeDecorators_1.PropNames.SerializeEncodeOrder].size;
        this[SerializeDecorators_1.PropNames.CalcBytesFunctions].forEach((func, shortKey) => {
            if (!complete && !this.changes.has(shortKey)) {
                return;
            }
            neededSize += func(this, complete);
        });
        this[SerializeDecorators_1.PropNames.NestedSerializableObjects].forEach((key, short_key) => {
            neededSize += this[key].calcNeededBufferSize(complete);
        });
        if (neededSize != 0) {
            neededSize += BitOperations_1.calcPropsMaskByteSize(propsSize);
        }
        return neededSize;
    }
    getPropsSize() {
        return this[SerializeDecorators_1.PropNames.SerializeEncodeOrder].size;
    }
    getPropsMaskByteSize() {
        let propsSize = this.getPropsSize();
        let propsByteSize = BitOperations_1.calcPropsMaskByteSize(propsSize);
        return propsByteSize == 3 ? 4 : propsByteSize;
    }
    serialize(updateBufferView, offset, complete = false) {
        if (this.forceComplete) {
            this.forceComplete = false;
            complete = true;
        }
        let propsSize = this.getPropsSize();
        let propsMaskByteSize = this.getPropsMaskByteSize();
        let updatedOffset = offset + propsMaskByteSize;
        let presentMask = 0;
        if (complete) {
            presentMask = Math.pow(2, propsSize) - 1;
        }
        if (this[SerializeDecorators_1.PropNames.SerializeFunctions]) {
            this[SerializeDecorators_1.PropNames.SerializeFunctions].forEach((serializeFunc, shortKey) => {
                if (this.changes.has(shortKey) || complete) {
                    let index = this[SerializeDecorators_1.PropNames.SerializeEncodeOrder].get(shortKey);
                    updatedOffset += serializeFunc(this, updateBufferView, updatedOffset);
                    presentMask = BitOperations_1.setBit(presentMask, index);
                }
            });
        }
        if (this[SerializeDecorators_1.PropNames.NestedSerializableObjects]) {
            this[SerializeDecorators_1.PropNames.NestedSerializableObjects].forEach((key, shortKey) => {
                let index = this[SerializeDecorators_1.PropNames.SerializeEncodeOrder].get(shortKey);
                let tmpOffset = updatedOffset;
                updatedOffset = this[key].serialize(updateBufferView, updatedOffset, complete);
                if (tmpOffset < updatedOffset) {
                    presentMask = BitOperations_1.setBit(presentMask, index);
                }
            });
        }
        if (updatedOffset == (offset + propsMaskByteSize)) {
            return offset;
        }
        if (propsMaskByteSize == 1) {
            updateBufferView.setUint8(offset, presentMask);
        }
        else if (propsMaskByteSize == 2) {
            updateBufferView.setUint16(offset, presentMask);
        }
        else if (propsMaskByteSize == 4) {
            updateBufferView.setUint32(offset, presentMask);
        }
        this.changes.clear();
        return updatedOffset;
    }
    deserialize(updateBufferView, offset) {
        this.deserializedFields.clear();
        this.lastUpdateTick = TicksCounter_1.TicksCounter.Instance.LastTickNumber;
        let propsMaskByteSize = this.getPropsMaskByteSize();
        let presentMask;
        if (propsMaskByteSize == 1) {
            presentMask = updateBufferView.getUint8(offset);
        }
        else if (propsMaskByteSize == 2) {
            presentMask = updateBufferView.getUint16(offset);
        }
        else if (propsMaskByteSize == 4) {
            presentMask = updateBufferView.getUint32(offset);
        }
        offset += propsMaskByteSize;
        let objectsToDecode = [];
        let index = 0;
        while (presentMask) {
            let bitMask = (1 << index);
            if ((presentMask & bitMask) == 0) {
                index++;
                continue;
            }
            presentMask &= ~bitMask;
            let shortKey = this[SerializeDecorators_1.PropNames.SerializeDecodeOrder].get(index);
            let type = this[SerializeDecorators_1.PropNames.PropertyTypes].get(shortKey);
            if (type == SerializableTypes.Object) {
                objectsToDecode.push(index);
            }
            else {
                offset += this[SerializeDecorators_1.PropNames.DeserializeFunctions].get(shortKey)(this, updateBufferView, offset);
                this.deserializedFields.add(shortKey);
            }
            index++;
        }
        objectsToDecode.forEach((index) => {
            let shortKey = this[SerializeDecorators_1.PropNames.SerializeDecodeOrder].get(index);
            let key = this[SerializeDecorators_1.PropNames.NestedSerializableObjects].get(shortKey);
            offset = this[key].deserialize(updateBufferView, offset);
        });
        return offset;
    }
    get DeserializedFields() {
        return this.deserializedFields;
    }
    get LastUpdateTick() {
        return this.lastUpdateTick;
    }
}
Serializable.TypesToBytesSize = new Map([
    [SerializableTypes.Int8, 1],
    [SerializableTypes.Int16, 2],
    [SerializableTypes.Int32, 4],
    [SerializableTypes.Uint8, 1],
    [SerializableTypes.Uint16, 2],
    [SerializableTypes.Uint32, 4],
    [SerializableTypes.Float32, 4],
    [SerializableTypes.Float64, 8],
]);
exports.Serializable = Serializable;

},{"../SharedConfig":88,"../utils/TicksCounter":123,"../utils/functions/BitOperations":124,"./SerializeDecorators":119}],119:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Serializable_1 = require("./Serializable");
var PropNames;
(function (PropNames) {
    PropNames.SerializeFunctions = "SerializeFunctions";
    PropNames.DeserializeFunctions = "DeserializeFunctions";
    PropNames.CalcBytesFunctions = "CalcBytesFunctions";
    PropNames.SerializeEncodeOrder = "SerializeEncodeOrder";
    PropNames.SerializeDecodeOrder = "SerializeDecodeOrder";
    PropNames.PropertyTypes = "PropertyType";
    PropNames.DecodeCounter = "DecodeCounter";
    PropNames.NestedSerializableObjects = "NestedSerializableObjects";
})(PropNames = exports.PropNames || (exports.PropNames = {}));
function fillString(str, view, offset) {
    view.setUint8(offset, str.length);
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i + 1, str.charCodeAt(i));
    }
}
function decodeString(view, offset) {
    let len = view.getUint8(offset);
    let str = "";
    for (let i = 1; i <= len; i++) {
        str += String.fromCharCode(view.getUint8(i + offset));
    }
    return str;
}
function SerializableProperty(shortKey, type) {
    function decorator(target, key) {
        addSerializableProperties(target);
        let counter = target[PropNames.DecodeCounter]++;
        target[PropNames.SerializeEncodeOrder].set(shortKey, counter);
        target[PropNames.SerializeDecodeOrder].set(counter, shortKey);
        target[PropNames.PropertyTypes].set(shortKey, type);
        target[PropNames.SerializeFunctions].set(shortKey, (object, view, offset) => {
            let type = object[PropNames.PropertyTypes].get(shortKey);
            if (type == Serializable_1.SerializableTypes.String) {
                fillString(object[key], view, offset);
                return object[key].length + 1;
            }
            else if (type == Serializable_1.SerializableTypes.Int8) {
                view.setInt8(offset, object[key]);
            }
            else if (type == Serializable_1.SerializableTypes.Int16) {
                view.setInt16(offset, object[key]);
            }
            else if (type == Serializable_1.SerializableTypes.Int32) {
                view.setInt32(offset, object[key]);
            }
            else if (type == Serializable_1.SerializableTypes.Uint8) {
                view.setUint8(offset, object[key]);
            }
            else if (type == Serializable_1.SerializableTypes.Uint16) {
                view.setUint16(offset, object[key]);
            }
            else if (type == Serializable_1.SerializableTypes.Uint32) {
                view.setUint32(offset, object[key]);
            }
            else if (type == Serializable_1.SerializableTypes.Float32) {
                view.setFloat32(offset, object[key]);
            }
            else if (type == Serializable_1.SerializableTypes.Float64) {
                view.setFloat64(offset, object[key]);
            }
            return Serializable_1.Serializable.TypesToBytesSize.get(type);
        });
        target[PropNames.DeserializeFunctions].set(shortKey, (object, view, offset) => {
            if (type == Serializable_1.SerializableTypes.String) {
                object[key] = decodeString(view, offset);
                return object[key].length + 1;
            }
            else if (type == Serializable_1.SerializableTypes.Int8) {
                object[key] = view.getInt8(offset);
            }
            else if (type == Serializable_1.SerializableTypes.Int16) {
                object[key] = view.getInt16(offset);
            }
            else if (type == Serializable_1.SerializableTypes.Int32) {
                object[key] = view.getInt32(offset);
            }
            else if (type == Serializable_1.SerializableTypes.Uint8) {
                object[key] = view.getUint8(offset);
            }
            else if (type == Serializable_1.SerializableTypes.Uint16) {
                object[key] = view.getUint16(offset);
            }
            else if (type == Serializable_1.SerializableTypes.Uint32) {
                object[key] = view.getUint32(offset);
            }
            else if (type == Serializable_1.SerializableTypes.Float32) {
                object[key] = view.getFloat32(offset);
            }
            else if (type == Serializable_1.SerializableTypes.Float64) {
                object[key] = view.getFloat64(offset);
            }
            return Serializable_1.Serializable.TypesToBytesSize.get(type);
        });
        target[PropNames.CalcBytesFunctions].set(shortKey, (object, complete) => {
            let type = target[PropNames.PropertyTypes].get(shortKey);
            if (type == Serializable_1.SerializableTypes.String) {
                return object[key].length + 1;
            }
            else if (type == Serializable_1.SerializableTypes.Object) {
                return object[key].calcNeededBufferSize(complete);
            }
            else {
                return Serializable_1.Serializable.TypesToBytesSize.get(type);
            }
        });
    }
    return decorator;
}
exports.SerializableProperty = SerializableProperty;
function SerializableObject(shortKey) {
    function decorator(target, key) {
        addSerializableProperties(target);
        target[PropNames.PropertyTypes].set(shortKey, Serializable_1.SerializableTypes.Object);
        let counter = target[PropNames.DecodeCounter]++;
        target[PropNames.SerializeEncodeOrder].set(shortKey, counter);
        target[PropNames.SerializeDecodeOrder].set(counter, shortKey);
        target[PropNames.NestedSerializableObjects].set(shortKey, key);
    }
    return decorator;
}
exports.SerializableObject = SerializableObject;
function addSerializableProperties(target) {
    createMapProperty(target, PropNames.SerializeFunctions);
    createMapProperty(target, PropNames.DeserializeFunctions);
    createMapProperty(target, PropNames.CalcBytesFunctions);
    createMapProperty(target, PropNames.SerializeEncodeOrder);
    createMapProperty(target, PropNames.SerializeDecodeOrder);
    createMapProperty(target, PropNames.PropertyTypes);
    createMapProperty(target, PropNames.NestedSerializableObjects);
    addDcecodeCounter(target);
}
function createMapProperty(target, propertyName) {
    if (!target.hasOwnProperty(propertyName)) {
        let propertyVal = getPrototypePropertyVal(target, propertyName, null);
        propertyVal = new Map(propertyVal);
        createProperty(target, propertyName, propertyVal);
    }
}
function createProperty(target, propertyName, propertyVal) {
    Object.defineProperty(target, propertyName, {
        value: propertyVal,
        writable: true,
        enumerable: true,
        configurable: true
    });
}
function addDcecodeCounter(target) {
    if (!target.hasOwnProperty(PropNames.DecodeCounter)) {
        let propertyVal = getPrototypePropertyVal(target, PropNames.DecodeCounter, 0);
        createProperty(target, PropNames.DecodeCounter, propertyVal);
    }
}
function getPrototypePropertyVal(target, propertyName, defaultVal) {
    let basePrototype = target;
    while (basePrototype) {
        let prototype = Object.getPrototypeOf(basePrototype);
        basePrototype = prototype;
        if (basePrototype && prototype.hasOwnProperty(propertyName)) {
            return prototype[propertyName];
        }
    }
    return defaultVal;
}

},{"./Serializable":118}],120:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsSubscriber_1 = require("../game_utils/factory/GameObjectsSubscriber");
const SharedConfig_1 = require("../SharedConfig");
const ObjectsFactory_1 = require("../game_utils/factory/ObjectsFactory");
const GameObjectPrefabs_1 = require("../game_utils/factory/GameObjectPrefabs");
class UpdateCollector extends GameObjectsSubscriber_1.GameObjectsSubscriber {
    constructor(chunksManager) {
        super();
        this.chunksManager = chunksManager;
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.destroyedObjects = new Map();
            let chunks = this.chunksManager.Chunks;
            for (let i = 0; i < chunks.length; i++) {
                for (let j = 0; j < chunks[i].length; j++) {
                    this.destroyedObjects.set(chunks[i][j], []);
                }
            }
        }
    }
    onObjectDestroy(gameObject) {
        let chunk = this.chunksManager.getObjectChunk(gameObject);
        if (!chunk) {
            console.log("WARNING! destroyed object that doesn't belong to any chunk");
            return;
        }
        if (SharedConfig_1.SharedConfig.IS_SERVER) {
            this.destroyedObjects.get(chunk).push(gameObject.ID);
        }
    }
    collectUpdate() {
        let chunksUpdate = new Map();
        let chunks = this.chunksManager.Chunks;
        for (let i = 0; i < chunks.length; i++) {
            for (let j = 0; j < chunks[i].length; j++) {
                let chunk = chunks[i][j];
                //no need to send update from chunk, that doesnt have players
                if (!chunk.HasPlayersInNeighborhood) {
                    //no need to keep leavers if there is no one to send them
                    chunk.resetLeavers();
                    this.destroyedObjects.set(chunk, []);
                    continue;
                }
                //if chunk has new players inside we need to send complete update to them
                let chunkCompleteUpdate = chunk.IsNextUpdateComplete;
                chunk.IsNextUpdateComplete = false;
                let neededBufferSize = 0;
                let objectsToUpdateMap = new Map();
                chunk.Objects.forEach((gameObject) => {
                    if (gameObject.IsDestroyed)
                        return;
                    let neededSize = gameObject.calcNeededBufferSize(chunkCompleteUpdate);
                    if (neededSize > 0) {
                        objectsToUpdateMap.set(gameObject, neededBufferSize);
                        //need 5 bits for obj ID
                        neededBufferSize += neededSize + UpdateCollector.OBJECT_ID_BYTES_LEN;
                    }
                });
                //when object leaves chunk, we need to send his position last time to clients,
                //so they are able to detect object is no longer in their chunks
                chunk.Leavers.forEach((gameObject) => {
                    if (objectsToUpdateMap.has(gameObject)) {
                        return;
                    }
                    if (gameObject.IsDestroyed) {
                        this.destroyedObjects.get(chunk).push(gameObject.ID);
                        return;
                    }
                    let neededSize = gameObject.calcNeededBufferSize(chunkCompleteUpdate);
                    if (neededSize > 0) {
                        objectsToUpdateMap.set(gameObject, neededBufferSize);
                        //need 5 bits for obj ID
                        neededBufferSize += neededSize + UpdateCollector.OBJECT_ID_BYTES_LEN;
                    }
                });
                let destrotObjectsOffset = neededBufferSize;
                if (this.destroyedObjects.get(chunk).length > 0) {
                    neededBufferSize += (this.destroyedObjects.get(chunk).length * 5) + 1;
                }
                if (neededBufferSize == 0) {
                    chunk.resetLeavers();
                    this.destroyedObjects.set(chunk, []);
                    continue;
                }
                let updateBuffer = new ArrayBuffer(neededBufferSize);
                let updateBufferView = new DataView(updateBuffer);
                objectsToUpdateMap.forEach((offset, gameObject) => {
                    updateBufferView.setUint8(offset, gameObject.ID.charCodeAt(0));
                    updateBufferView.setUint32(offset + 1, Number(gameObject.ID.slice(1)));
                    gameObject.serialize(updateBufferView, offset + 5, chunkCompleteUpdate);
                });
                if (this.destroyedObjects.get(chunk).length > 0) {
                    updateBufferView.setUint8(destrotObjectsOffset++, UpdateCollector.DESTROY_OBJECTS_ID);
                    this.destroyedObjects.get(chunk).forEach((id) => {
                        updateBufferView.setUint8(destrotObjectsOffset, id.charCodeAt(0));
                        updateBufferView.setUint32(destrotObjectsOffset + 1, Number(id.slice(1)));
                        destrotObjectsOffset += 5;
                        // console.log("destroy3 " + id + ", chunk " + chunk.x + "-" + chunk.y);
                    });
                }
                chunk.resetLeavers();
                this.destroyedObjects.set(chunk, []);
                chunksUpdate.set(chunk, updateBuffer);
            }
        }
        return chunksUpdate;
    }
    decodeUpdate(updateBuffer) {
        let updateBufferView = new DataView(updateBuffer);
        let offset = 0;
        while (offset < updateBufferView.byteLength) {
            let id = String.fromCharCode(updateBufferView.getUint8(offset));
            if (id == String.fromCharCode(UpdateCollector.DESTROY_OBJECTS_ID)) {
                offset = this.decodeDestroyedObjects(updateBufferView, offset + 1);
                break;
            }
            id += updateBufferView.getUint32(offset + 1).toString();
            offset += 5;
            let gameObject = this.getGameObject(id);
            if (gameObject == null) {
                const prefabId = id[0];
                gameObject = ObjectsFactory_1.GameObjectsFactory.Instatiate(GameObjectPrefabs_1.Prefabs.IdToPrefabNames.get(prefabId), id, [updateBufferView, offset]);
            }
            offset = gameObject.deserialize(updateBufferView, offset);
        }
    }
    decodeDestroyedObjects(updateBufferView, offset) {
        while (offset < updateBufferView.byteLength) {
            let idToRemove = String.fromCharCode(updateBufferView.getUint8(offset)) +
                updateBufferView.getUint32(offset + 1).toString();
            let gameObject = this.getGameObject(idToRemove);
            if (gameObject) {
                gameObject.destroy();
            }
            offset += 5;
        }
        return offset;
    }
}
UpdateCollector.OBJECT_ID_BYTES_LEN = 5;
UpdateCollector.DESTROY_OBJECTS_ID = 255;
exports.UpdateCollector = UpdateCollector;

},{"../SharedConfig":88,"../game_utils/factory/GameObjectPrefabs":92,"../game_utils/factory/GameObjectsSubscriber":94,"../game_utils/factory/ObjectsFactory":95}],121:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AverageCounter {
    constructor(historySize) {
        this.history = [];
        this.historyMaxSize = historySize;
    }
    add(val) {
        this.history.push(val);
        while (this.history.length > this.historyMaxSize)
            this.history.splice(0, 1);
    }
    calculate(val) {
        if (val) {
            this.add(val);
        }
        let avg = 0;
        this.history.forEach((val) => {
            avg += val;
        });
        avg /= this.history.length;
        return avg;
    }
}
exports.AverageCounter = AverageCounter;

},{}],122:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DeltaTimer {
    constructor() {
        this.lastUpdate = DeltaTimer.getTimestamp();
    }
    getDelta() {
        this.currentTime = DeltaTimer.getTimestamp();
        this.delta = this.currentTime - this.lastUpdate;
        this.lastUpdate = this.currentTime;
        return this.delta;
    }
    ;
    static getTimestamp() {
        return Date.now();
    }
}
exports.DeltaTimer = DeltaTimer;

},{}],123:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TicksCounter {
    constructor() {
        this.ticks = 0;
    }
    update() {
        this.ticks++;
    }
    get LastTickNumber() {
        return this.ticks;
    }
    static get Instance() {
        if (!TicksCounter.instance) {
            TicksCounter.instance = new TicksCounter();
        }
        return TicksCounter.instance;
    }
}
TicksCounter.instance = null;
exports.TicksCounter = TicksCounter;

},{}],124:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function calcPropsMaskByteSize(num) {
    return Math.ceil(num / 8);
}
exports.calcPropsMaskByteSize = calcPropsMaskByteSize;
function setBit(val, bitIndex) {
    val |= (1 << bitIndex);
    return val;
}
exports.setBit = setBit;

},{}],125:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function calcAngle(p1, p2) {
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) + Math.PI;
}
exports.calcAngle = calcAngle;

},{}]},{},[25]);
