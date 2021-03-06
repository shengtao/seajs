/**
 * @preserve SeaJS - A Module Loader for the Web
 * v2.0.0-dev | seajs.org | MIT Licensed
 */
(function(global, undefined) {
"use strict"

// Avoid conflicting when `sea.js` is loaded multiple times
if (global.seajs) {
  return
}

var seajs = {
  // The current version of SeaJS being used
  version: "2.0.0-dev"
}

// Debug mode that will be turned off when building
var debugMode = "@DEBUG"

// The flag for test environment
var TEST_MODE = true

// Such code bellow will be removed when building
if (TEST_MODE) {
  var test = seajs.test = {}
}


/**
 * util-lang.js - The minimal language enhancement
 */

var emptyArr = []
var emptyObj = {}
var toString = emptyObj.toString
var hasOwn = emptyObj.hasOwnProperty
var slice = emptyArr.slice

function hasOwnProperty(obj, prop) {
  hasOwn.apply(obj, prop)
}

function isString(obj) {
  return toString.call(obj) === '[object String]'
}

function isFunction(obj) {
  return toString.call(obj) === '[object Function]'
}

var isArray = Array.isArray || function(obj) {
  return toString.call(obj) === '[object Array]'
}

var forEach = emptyArr.forEach ?
    function(arr, fn) {
      arr.forEach(fn)
    } :
    function(arr, fn) {
      for (var i = 0, len = arr.length; i < len; i++) {
        fn(arr[i], i, arr)
      }
    }

var map = emptyArr.map ?
    function(arr, fn) {
      return arr.map(fn)
    } :
    function(arr, fn) {
      var ret = []

      forEach(arr, function(item, i, arr) {
        ret.push(fn(item, i, arr))
      })

      return ret
    }

var filter = emptyArr.filter ?
    function(arr, fn) {
      return arr.filter(fn)
    } :
    function(arr, fn) {
      var ret = []

      forEach(arr, function(item, i, arr) {
        if (fn(item, i, arr)) {
          ret.push(item)
        }
      })

      return ret
    }

var keys = Object.keys || function(obj) {
  var ret = []

  for (var p in obj) {
    if (hasOwnProperty(obj, p)) {
      ret.push(p)
    }
  }

  return ret
}

function unique(arr) {
  var obj = {}

  forEach(arr, function(item) {
    obj[item] = 1
  })

  return keys(obj)
}


/**
 * util-log.js - The tiny log function
 */

var console = global.console

// The safe wrapper for `console.xxx` functions
// log('message') ==> console.log('message')
// log('message', 'warn') ==> console.warn('message')
var log = seajs.log = function() {
  if (console === undefined) {
    return
  }

  var args = slice.call(arguments)
  var len = args.length
  var type = console[args[len - 1]] ? args.pop() : 'log'

  // Print log info in debug mode only
  if (type === 'log' && !debugMode) {
    return
  }

  var fn = console[type]

  // The console function has no `apply` method in IE9
  // http://stackoverflow.com/questions/5538972
  fn = fn.apply ? fn :
      Function.prototype.bind.call(fn, console)
  fn.apply(console, args)
}


/**
 * util-events.js - The minimal events support
 */

var eventsCache = {}

// Bind event
seajs.on = function(event, callback) {
  if (!callback) return seajs

  var list = eventsCache[event] || (eventsCache[event] = [])
  list.push(callback)

  return seajs
}

// Remove event. If `callback` is undefined, remove all callbacks for the
// event. If `event` and `callback` are both undefined, remove all callbacks
// for all events
seajs.off = function(event, callback) {
  // Remove *all* events
  if (!(event || callback)) {
    eventsCache = {}
    return seajs
  }

  var list = eventsCache[event]
  if (list) {
    if (callback) {
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i] === callback) {
          list.splice(i, 1)
        }
      }
    }
    else {
      delete eventsCache[event]
    }
  }

  return seajs
}

// Emit event, firing all bound callbacks. Callbacks are passed the same
// arguments as `emit` is, apart from the event name
var emit = seajs.emit = function(event) {
  var list = eventsCache[event]
  if (!list) return seajs

  var args = []

  // Fill up `args` with the callback arguments.  Since we're only copying
  // the tail of `arguments`, a loop is much faster than Array#slice
  for (var i = 1, len = arguments.length; i < len; i++) {
    args[i - 1] = arguments[i]
  }

  // Copy callback lists to prevent modification
  list = list.slice()

  // Execute event callbacks
  forEach(list, function(fn) {
    fn.apply(global, args)
  })

  return seajs
}

// Emit event and return the specified property of the data
function emitData(event, data, prop) {
  emit(event, data)
  return data[prop || keys(data)[0]]
}


// For test environment
if(TEST_MODE) {
  test.emitData = emitData
}


/**
 * util-path.js - The utilities for operating path such as id, uri
 */

var DIRNAME_RE = /[^?]*(?=\/.*$)/
var MULTIPLE_SLASH_RE = /([^:\/])\/\/+/g
var URI_END_RE = /\.(?:css|js)|\/$/
var ROOT_RE = /^(.*?\w)(?:\/|$)/
var VARS_RE = /{([^{}]+)}/g


// Extract the directory portion of a path
// dirname('a/b/c.js') ==> 'a/b/'
// dirname('d.js') ==> './'
// ref: http://jsperf.com/regex-vs-split/2
function dirname(path) {
  var s = path.match(DIRNAME_RE)
  return (s ? s[0] : '.') + '/'
}

// Canonicalize a path
// realpath('./a//b/../c') ==> 'a/c'
function realpath(path) {
  MULTIPLE_SLASH_RE.lastIndex = 0

  // 'file:///a//b/c' ==> 'file:///a/b/c'
  // 'http://a//b/c' ==> 'http://a/b/c'
  if (MULTIPLE_SLASH_RE.test(path)) {
    path = path.replace(MULTIPLE_SLASH_RE, '$1\/')
  }

  // If 'a/b/c', just return
  if (path.indexOf('.') === -1) {
    return path
  }

  var original = path.split('/')
  var ret = [], part

  for (var i = 0; i < original.length; i++) {
    part = original[i]

    if (part === '..') {
      if (ret.length === 0) {
        throw new Error('The path is invalid: ' + path)
      }
      ret.pop()
    }
    else if (part !== '.') {
      ret.push(part)
    }
  }

  return ret.join('/')
}

// Normalize an uri
// normalize('path/to/a') ==> 'path/to/a.js'
function normalize(uri) {
  var lastChar = uri.charAt(uri.length - 1)

  // Add the default `.js` extension except that the uri ends with `#`
  if (lastChar === '#') {
    uri = uri.slice(0, -1)
  }
  else if (!URI_END_RE.test(uri) && uri.indexOf('?') === -1) {
    uri += '.js'
  }

  // Fixes `:80` bug in IE
  uri = uri.replace(':80/', '/')

  return realpath(uri)
}


function parseAlias(id) {
  var alias = config.alias

  // Only parse top-level id
  if (alias && alias.hasOwnProperty(id) && isTopLevel(id)) {
    id = alias[id]
  }

  return id
}

function parseVars(id) {
  var vars = config.vars

  if (vars && id.indexOf('{') > -1) {
    id = id.replace(VARS_RE, function(m, key) {
      return vars.hasOwnProperty(key) ? vars[key] : key
    })
  }

  return id
}

function addBase(id, refUri) {
  var ret

  // absolute id
  if (isAbsolute(id)) {
    ret = id
  }
  // relative id
  else if (isRelative(id)) {
    // Convert './a' to 'a', to avoid unnecessary loop in realpath() call
    if (id.indexOf('./') === 0) {
      id = id.substring(2)
    }
    ret = dirname(refUri) + id
  }
  // root id
  else if (isRoot(id)) {
    ret = refUri.match(ROOT_RE)[1] + id
  }
  // top-level id
  else {
    ret = config.base + '/' + id
  }

  return ret
}

function parseMap(uri) {
  var map = config.map || []
  var ret = uri
  var len = map.length

  if (len) {
    for (var i = 0; i < len; i++) {
      var rule = map[i]

      ret = isFunction(rule) ?
          rule(uri) :
          uri.replace(rule[0], rule[1])

      // Only apply the first matched rule
      if (ret !== uri) break
    }

    if (!isAbsolute(ret)) {
      ret = realpath(dirname(pageUri) + ret)
    }
  }

  return ret
}

function id2Uri(id, refUri) {
  if (!id) return ''

  id = parseAlias(id)
  id = parseVars(id)
  id = addBase(id, refUri || pageUri)
  id = normalize(id)
  id = parseMap(id)

  return id
}


function isAbsolute(id) {
  return id.indexOf('://') > 0 || id.indexOf('//') === 0
}

function isRelative(id) {
  return id.indexOf('./') === 0 || id.indexOf('../') === 0
}

function isRoot(id) {
  return id.charAt(0) === '/' && id.charAt(1) !== '/'
}

function isTopLevel(id) {
  var c = id.charAt(0)
  return id.indexOf('://') === -1 && c !== '.' && c !== '/'
}


var pageUri = (function(loc) {
  var pathname = loc.pathname

  // Normalize pathname to start with '/'
  // ref: https://groups.google.com/forum/#!topic/seajs/9R29Inqk1UU
  if (pathname.charAt(0) !== '/') {
    pathname = '/' + pathname
  }

  var pageUri = loc.protocol + '//' + loc.host + pathname

  // local file in IE: C:\path\to\xx.js
  if (pageUri.indexOf('\\') > -1) {
    pageUri = pageUri.replace(/\\/g, '/')
  }

  return pageUri
})(global.location)


if (TEST_MODE) {
  test.dirname = dirname
  test.realpath = realpath
  test.normalize = normalize

  test.parseAlias = parseAlias
  test.parseVars = parseVars
  test.addBase = addBase
  test.parseMap = parseMap
  test.id2Uri = id2Uri

  test.isAbsolute = isAbsolute
  test.isRelative = isRelative
  test.isRoot = isRoot
  test.isTopLevel = isTopLevel
}


/**
 * util-request.js - The utilities for requesting script and style files
 * ref: tests/research/load-js-css/test.html
 */

var doc = document
var head = doc.head ||
    doc.getElementsByTagName('head')[0] ||
    doc.documentElement

var baseElement = head.getElementsByTagName('base')[0]

var IS_CSS_RE = /\.css(?:\?|$)/i
var READY_STATE_RE = /loaded|complete|undefined/

var currentlyAddingScript
var interactiveScript


function request(url, callback, charset) {
  var isCSS = IS_CSS_RE.test(url)
  var node = doc.createElement(isCSS ? 'link' : 'script')

  if (charset) {
    var cs = isFunction(charset) ? charset(url) : charset
    cs && (node.charset = cs)
  }

  assetOnload(node, callback)

  if (isCSS) {
    node.rel = 'stylesheet'
    node.href = url
  } else {
    node.async = 'async'
    node.src = url
  }

  // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
  // the end of the insert execution, so use `currentlyAddingScript` to
  // hold current node, for deriving url in `define` call
  currentlyAddingScript = node

  // ref: #185 & http://dev.jquery.com/ticket/2709
  baseElement ?
      head.insertBefore(node, baseElement) :
      head.appendChild(node)

  currentlyAddingScript = null
}

function assetOnload(node, callback) {
  if (node.nodeName === 'SCRIPT') {
    scriptOnload(node, callback)
  }
  else {
    styleOnload(node, callback)
  }
}

function scriptOnload(node, callback) {
  node.onload = node.onerror = node.onreadystatechange = function() {
    if (READY_STATE_RE.test(node.readyState)) {

      // Ensure only run once and handle memory leak in IE
      node.onload = node.onerror = node.onreadystatechange = null

      // Remove the script to reduce memory leak
      if (!debugMode) {
        head.removeChild(node)
      }

      // Dereference the node
      node = undefined

      callback && callback()
    }
  }
}

function styleOnload(node, callback) {
  // for Old WebKit and Old Firefox
  if (isOldWebKit || isOldFirefox) {
    log('Start css polling')

    setTimeout(function() {
      pollCss(node, callback)
    }, 1) // Begin after node insertion
  }
  else {
    node.onload = node.onerror = function() {
      node.onload = node.onerror = null
      node = undefined
      callback && callback()
    }
  }
}

function pollCss(node, callback) {
  var sheet = node.sheet
  var isLoaded

  // for WebKit < 536
  if (isOldWebKit) {
    if (sheet) {
      isLoaded = true
    }
  }
  // for Firefox < 9.0
  else if (sheet) {
    try {
      if (sheet.cssRules) {
        isLoaded = true
      }
    } catch (ex) {
      // The value of `ex.name` is changed from 'NS_ERROR_DOM_SECURITY_ERR'
      // to 'SecurityError' since Firefox 13.0. But Firefox is less than 9.0
      // in here, So it is ok to just rely on 'NS_ERROR_DOM_SECURITY_ERR'
      if (ex.name === 'NS_ERROR_DOM_SECURITY_ERR') {
        isLoaded = true
      }
    }
  }

  setTimeout(function() {
    if (isLoaded) {
      // Place callback in here due to giving time for style rendering
      callback()
    }
    else {
      pollCss(node, callback)
    }
  }, 1)
}


function getCurrentScript() {
  if (currentlyAddingScript) {
    return currentlyAddingScript
  }

  // For IE6-9 browsers, the script onload event may not fire right
  // after the the script is evaluated. Kris Zyp found that it
  // could query the script nodes and the one that is in "interactive"
  // mode indicates the current script
  // ref: http://goo.gl/JHfFW
  if (interactiveScript && interactiveScript.readyState === 'interactive') {
    return interactiveScript
  }

  var scripts = head.getElementsByTagName('script')

  for (var i = scripts.length - 1; i >= 0; i--) {
    var script = scripts[i]
    if (script.readyState === 'interactive') {
      interactiveScript = script
      return interactiveScript
    }
  }
}

function getScriptAbsoluteSrc(node) {
  return node.hasAttribute ? // non-IE6/7
      node.src :
    // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
      node.getAttribute('src', 4)
}


var UA = navigator.userAgent

// `onload` event is supported in WebKit since 535.23
// ref: https://bugs.webkit.org/show_activity.cgi?id=38995
var isOldWebKit = Number(UA.replace(/.*AppleWebKit\/(\d+)\..*/, '$1')) < 536

// `onload/onerror` event is supported since Firefox 9.0
// ref:
//  - https://bugzilla.mozilla.org/show_bug.cgi?id=185236
//  - https://developer.mozilla.org/en/HTML/Element/link#Stylesheet_load_events
var isOldFirefox = UA.indexOf('Firefox') > 0 &&
    !('onload' in document.createElement('link'))


/**
 * util-deps.js - The parser for dependencies
 * ref: tests/research/parse-dependencies/test.html
 */

var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g
var SLASH_RE = /\\\\/g

function parseDependencies(code) {
  var ret = [], m
  REQUIRE_RE.lastIndex = 0
  code = code.replace(SLASH_RE, '')

  while ((m = REQUIRE_RE.exec(code))) {
    if (m[2]) ret.push(m[2])
  }

  return unique(ret)
}


/**
 * The core of loader
 */

var cachedModules = {}
var compilingStack = []

var STATUS = {
  'LOADING': 1,   // The module file is loading.
  'SAVED': 2,     // The module has been saved to cachedModules.
  'LOADED': 3,    // The module and all its dependencies are ready to compile.
  'COMPILING': 4, // The module is being compiled.
  'COMPILED': 5   // The module is compiled and module.exports is available.
}


function Module(uri, status) {
  this.uri = uri
  this.status = status || STATUS.LOADING
  this.dependencies = []
  this.waitings = []
}


Module.prototype.use = function(ids, callback) {
  isString(ids) && (ids = [ids])
  var uris = resolve(ids, this.uri)

  this.load(uris, function() {
    // Loads preload files introduced in modules before compiling.
    preload(function() {
      var args = map(uris, function(uri) {
        return uri ? cachedModules[uri].compile() : null
      })

      if (callback) {
        callback.apply(null, args)
      }
    })
  })
}


Module.prototype.load = function(uris, callback, options) {
  options = options || {}
  var unloadedUris = options.filtered ? uris : getUnloadedUris(uris)
  var length = unloadedUris.length

  if (length === 0) {
    callback()
    return
  }

  // Emits load event.
  seajs.emit('load', unloadedUris)

  var remain = length
  for (var i = 0; i < length; i++) {
    (function(uri) {
      var mod = getModule(uri)
      mod.status < STATUS.SAVED ? fetch(uri, onFetched) : onFetched()

      function onFetched() {
        // Maybe failed to fetch successfully, such as 404 or non-module.
        // In these cases, just call cb function directly.
        if (mod.status < STATUS.SAVED) {
          return cb()
        }

        // Breaks circular waiting callbacks.
        if (isCircularWaiting(mod)) {
          printCircularLog(circularStack)
          circularStack.length = 0
          cb(mod)
        }

        var waitings = mod.waitings = getUnloadedUris(mod.dependencies)
        if (waitings.length === 0) {
          return cb(mod)
        }

        Module.prototype.load(waitings, function() {
          cb(mod)
        }, { filtered: true })
      }

    })(unloadedUris[i])
  }

  function cb(mod) {
    if (mod && mod.status < STATUS.LOADED) {
      mod.status = STATUS.LOADED
    }
    --remain === 0 && callback()
  }
}


Module.prototype.compile = function() {
  var mod = this
  if (mod.status === STATUS.COMPILED) {
    return mod.exports
  }

  seajs.emit('compile', mod)

  // Just return null when:
  //  1. the module file is 404.
  //  2. the module file is not written with valid module format.
  //  3. other error cases.
  if (mod.status < STATUS.SAVED && !mod.exports) {
    return null
  }

  compilingStack.push(mod)
  mod.status = STATUS.COMPILING


  function require(id) {
    var uri = resolve(id, mod.uri)
    var child = cachedModules[uri]

    // Just return null when uri is invalid.
    if (!child) {
      return null
    }

    // Avoids circular calls.
    if (child.status === STATUS.COMPILING) {
      return child.exports
    }

    child.parent = mod
    return child.compile()
  }

  require.async = function(ids, callback) {
    mod.use(ids, callback)
  }

  require.resolve = function(id) {
    return resolve(id, mod.uri)
  }

  require.cache = cachedModules


  mod.require = require
  mod.exports = mod.exports || {}
  var factory = mod.factory
  var ret = factory

  if (isFunction(factory)) {
    ret = factory(mod.require, mod.exports, mod)
  }

  if (ret !== undefined) {
    mod.exports = ret
  }

  mod.status = STATUS.COMPILED
  compilingStack.pop()

  seajs.emit('compiled', mod)
  return mod.exports
}


function resolve(ids, refUri) {
  if (isString(ids)) {
    var id = seajs.emitData('resolve', { id: ids, refUri: refUri }, 'id')
    return id2Uri(id, refUri)
  }

  return map(ids, function(id) {
    return resolve(id, refUri)
  })
}


function fetch(uri, callback) {
  // Emits `fetch` event, firing all bound callbacks, and gets
  // the modified uri.
  var requestUri = seajs.emitData('fetch', { uri: uri })

  if (fetchedList[requestUri]) {
    callback()
    return
  }

  if (fetchingList[requestUri]) {
    callbackList[requestUri].push(callback)
    return
  }

  fetchingList[requestUri] = true
  callbackList[requestUri] = [callback]


  // Sends request.
  var charset = config.charset

  var requested = seajs.emitData('request', {
    uri: requestUri,
    callback: finish,
    charset: charset
  }, 'requested')

  !requested && request(requestUri, finish, charset)


  function finish() {
    delete fetchingList[requestUri]
    fetchedList[requestUri] = true

    // Saves anonymous module
    if (anonymousModuleMeta) {
      save(uri, anonymousModuleMeta)
      anonymousModuleMeta = null
    }

    // Calls callbacks
    var fn, fns = callbackList[requestUri]
    delete callbackList[requestUri]
    while ((fn = fns.shift())) fn()
  }

}


function define(id, deps, factory) {
  var argsLength = arguments.length

  // define(factory)
  if (argsLength === 1) {
    factory = id
    id = undefined
  }
  // define(id || deps, factory)
  else if (argsLength === 2) {
    factory = deps
    deps = undefined

    // define(deps, factory)
    if (isArray(id)) {
      deps = id
      id = undefined
    }
  }

  // Parses dependencies according to the module code.
  if (!isArray(deps) && isFunction(factory)) {
    deps = parseDependencies(factory.toString())
  }

  var meta = { id: id, dependencies: deps, factory: factory }
  var derivedUri

  // Try to derive uri in IE6-9 for anonymous modules.
  if (!id && document.attachEvent) {
    var script = getCurrentScript()

    if (script && script.src) {
      derivedUri = getScriptAbsoluteSrc(script)
      derivedUri = seajs.emitData('derived', { uri: derivedUri })
    }
    else {
      log('Failed to derive URI from interactive script for:',
          factory.toString(), 'warn')

      // NOTE: If the id-deriving methods above is failed, then falls back
      // to use onload event to get the uri.
    }
  }

  var resolvedUri = id ? resolve(id) : derivedUri

  if (resolvedUri) {
    save(resolvedUri, meta)
  }
  else {
    // Saves information for "memoizing" work in the script onload event.
    anonymousModuleMeta = meta
  }

}


function save(uri, meta) {
  var mod = cachedModules[uri] || (cachedModules[uri] = new Module(uri))

  // Don't override already saved module
  if (mod.status < STATUS.SAVED) {
    // Lets anonymous module id equal to its uri
    mod.id = meta.id || uri

    mod.dependencies = resolve(
        filter(meta.dependencies || [], function(dep) {
          return !!dep
        }), uri)

    mod.factory = meta.factory

    // Updates module status
    mod.status = STATUS.SAVED
  }

  return mod
}


function preload(callback) {
  var preloadMods = config.preload.slice()
  config.preload = []
  preloadMods.length ? globalModule.use(preloadMods, callback) : callback()
}


// Helpers
// -------

var fetchingList = {}
var fetchedList = {}
var callbackList = {}
var anonymousModuleMeta = null
var circularStack = []

function getModule(uri, status) {
  return cachedModules[uri] ||
      (cachedModules[uri] = new Module(uri, status))
}

function getUnloadedUris(uris) {
  return filter(uris, function(uri) {
    return !cachedModules[uri] || cachedModules[uri].status < STATUS.LOADED
  })
}

function isCircularWaiting(mod) {
  var waitings = mod.waitings
  if (waitings.length === 0) {
    return false
  }

  circularStack.push(mod.uri)
  if (isOverlap(waitings, circularStack)) {
    return true
  }

  for (var i = 0; i < waitings.length; i++) {
    if (isCircularWaiting(cachedModules[waitings[i]])) {
      return true
    }
  }

  circularStack.pop()
  return false
}

function printCircularLog(stack) {
  stack.push(stack[0])
  log('Found circular dependencies:', stack.join(' --> '))
}

function isOverlap(arrA, arrB) {
  var arrC = arrA.concat(arrB)
  return arrC.length > unique(arrC).length
}


// Public API
// ----------

var globalModule = new Module(pageUri, STATUS.COMPILED)

seajs.use = function(ids, callback) {
  // Loads preload modules before all other modules.
  preload(function() {
    globalModule.use(ids, callback)
  })
  return seajs
}

seajs.cache = cachedModules

/**
 * The configuration
 */

// The configuration data for the loader
var config = {

  // Modules that are needed to load before all other modules
  preload: []
}

// Async inserted script
var loaderScript = document.getElementById('seajsnode')

// Static script
if (!loaderScript) {
  var scripts = document.getElementsByTagName('script')
  loaderScript = scripts[scripts.length - 1]
}

var loaderSrc = (loaderScript && getScriptAbsoluteSrc(loaderScript)) ||
    pageUri // When sea.js is inline, set base to pageUri.

var base = dirname(loaderSrc)
var loaderDir = base

// When src is "http://test.com/libs/seajs/1.0.0/sea.js", redirect base
// to "http://test.com/libs/"
var match = base.match(/^(.+\/)seajs\/[\.\d]+(?:-dev)?\/$/)
if (match) base = match[1]

config.base = base
config.main = loaderScript && loaderScript.getAttribute('data-main')
config.charset = 'utf-8'


/**
 * The function to configure the framework
 * config({
   *   'base': 'path/to/base',
   *   'vars': {
   *     'locale': 'zh-cn'
   *   },
   *   'alias': {
   *     'app': 'biz/xx',
   *     'jquery': 'jquery-1.5.2',
   *     'cart': 'cart?t=20110419'
   *   },
   *   'map': [
   *     ['test.cdn.cn', 'localhost']
   *   ],
   *   preload: [],
   *   charset: 'utf-8',
   *   debug: false
   * })
 *
 */
seajs.config = function(o) {
  for (var k in o) {
    if (!o.hasOwnProperty(k)) continue

    var previous = config[k]
    var current = o[k]

    if (previous && (k === 'alias' || k === 'vars')) {
      for (var p in current) {
        if (current.hasOwnProperty(p)) {
          var prevValue = previous[p]
          var currValue = current[p]

          checkAliasConflict(prevValue, currValue, p)
          previous[p] = currValue
        }
      }
    }
    else if (previous && (k === 'map' || k === 'preload')) {
      // for config({ preload: 'some-module' })
      if (isString(current)) {
        current = [current]
      }

      forEach(current, function(item) {
        if (item) {
          previous.push(item)
        }
      })
    }
    else {
      config[k] = current
    }
  }

  // Makes sure config.base is an absolute path.
  var base = config.base
  if (base && !isAbsolute(base)) {
    config.base = id2Uri((isRoot(base) ? '' : './') + base + '/')
  }

  debugSync()

  return this
}


function debugSync() {
  // For convenient reference
  seajs.debug = !!config.debug
}

debugSync()

function checkAliasConflict(previous, current, key) {
  if (previous && previous !== current) {
    log('The alias config is conflicted:',
        'key =', '"' + key + '"',
        'previous =', '"' + previous + '"',
        'current =', '"' + current + '"',
        'warn')
  }
}

/**
 * Prepare for bootstrapping
 */

  // The safe and convenient version of console.log
seajs.log = log


// Sets a alias to `sea.js` directory for loading plugins.
seajs.config({
  vars: { seajs: loaderDir }
})


// Uses `seajs-xxx` flag to load plugin-xxx.
forEach(getStartupPlugins(), function(name) {
  seajs.use('{seajs}/plugin-' + name)

  // Delays `seajs.use` calls to the onload of `mapfile` in debug mode.
  if (name === 'debug') {
    seajs._use = seajs.use
    seajs._useArgs = []
    seajs.use = function() {
      seajs._useArgs.push(arguments);
      return seajs
    }
  }
})


// Helpers
// -------

function getStartupPlugins() {
  var ret = []
  var str = global.location.search

  // Converts `seajs-xxx` to `seajs-xxx=1`
  str = str.replace(/(seajs-\w+)(&|$)/g, '$1=1$2')

  // Add cookie string
  str += ' ' + document.cookie

  // Excludes seajs-xxx=0
  str.replace(/seajs-(\w+)=[1-9]/g, function(m, name) {
    ret.push(name)
  })

  return unique(ret)
}

/**
 * The bootstrap and entrances
 */


// Assigns to global define.
global.define = define


// Loads the data-main module automatically.
config.main && seajs.use(config.main)


// For plugin developers
seajs.pluginSDK = {
  config: config,
  cachedModules: cachedModules,
  compilingStack: compilingStack,
  STATUS: STATUS
}

})(this);
