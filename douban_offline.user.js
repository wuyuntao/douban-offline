// {{{ === License ===  
// Douban Offline
// A Greasemonkey script allows you to use douban offline and backup your collections
// version 0.1
// Copyright (c) 2008 Wu Yuntao <http://blog.luliban.com/>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
// --------------------------------------------------------------------
// This is a Greasemonkey user script.
//
// To install, you need Greasemonkey: http://greasemonkey.mozdev.org/
// Then restart Firefox and revisit this script.
// Under Tools, there will be a new menu item to "Install User Script".
// Accept the default configuration and install.
// --------------------------------------------------------------------
//
// ==UserScript==
// @name            Douban Offline
// @namespace       http://blog.luliban.com/
// @description     A Greasemonkey script allows you to use douban offline and backup your collections
// @include         http://www.douban.com/*
// @include         http://otho.douban.com/*
// @resource        favicon http://lotho.douban.com/favicon.ico
// @require         http://www.douban.com/js/jquery5685.js
// ==/UserScript==
//
// }}}

/* {{{ === Global variables ===  
 */
// Constants
const host = location.protocol + '//' + location.host;
const href = location.href;
// Gears
var server = null;
var store = null;
var db = null;
var workerPoll = null;
// Browser
var console = unsafeWindow.console || { log: function() {} };

/* End of global varaible definitions
 * }}} */

/* {{{ === Douban functions ===  
 * Initialize jQuery and Gears for www.douban.com
 */
function initDoubanGM() {
    window.$G = new initGears();
    if (!server) {
        triggerAllowDoubanDialog();
    } else {
        // Do something ...
        var urls = getExternalLinks();
        capture(urls.doubanUrls);
        initFrame(urls.othoUrls);
    }
    // debug();
}

/* Check if the current page is www.douban.com origin
 */
function isDouban(url) {
    return (url.indexOf('www.douban.com') != -1)
}

/* This is called if the user hasn't allowed www.douban.com to use Gears
 */
function triggerAllowDoubanDialog() {
    window.addEventListener("load", function() {
        $G.factory.create('beta.localserver', '1.0');
        location.href = location.href;
        return false;
    }, true);
}

/* End of www.douban.com functions
 * }}} */

/* {{{ === Media functions ===  
 * Initialize jQuery and Gears for otho.douban.com
 */
function initOthoGM() {
    window.$G = new initGears();
    if (!server) {
        triggerAllowOthoDialog();
    } else {
        // Do something ...
        var othoUrls = location.href.split('#')[1];
        var urls = othoUrls.split("|");
        capture(urls);
    }
}

/* Check if the current page is www.douban.com origin
 */
function isMedia(url) {
    return (url.indexOf('otho.douban.com') != -1)
}

/* This is called if the user hasn't allowed otho.douban.com to use Gears
 */
function triggerAllowOthoDialog() {
    window.addEventListener("load", function() {
        $G.factory.create('beta.localserver', '1.0');
        return false;
    }, true);
}

/* End of otho.douban.com functions
 * }}} */

/* {{{ === General functions ===  
 * Initialize Gears for both www.douban.com and otho.douban.com
 */
function initGears() {
    if (!unsafeWindow.google) unsafeWindow.google = {};
    if (!unsafeWindow.google.gears) {
        try {
            unsafeWindow.google.gears = {};
            unsafeWindow.google.gears.factory = unsafeWindow.GearsFactory();
            // unsafeWindow.google.gears = { factory: new GearsFactory() };
        } catch(e) {
            alert("Problem in initializing Gears: " + e.message)
        }
    }
    try {
        server = unsafeWindow.google.gears.factory.create('beta.localserver');
        store = server.createStore('douban_offline');
        db = unsafeWindow.google.gears.factory.create('beta.database');
        if (db) {
            db.open('douban_offline');
            db.execute('CREATE TABLE IF NOT EXISTS DoubanOffline' +
                       ' (Content VARCHAR(255), URL VARCHAR(255), TransactionID INT)');
        }
    } catch(e) {
        console.log("Problem in initializing database: " + e.message);
    }
    return unsafeWindow.google.gears;
}

/* Initialize an iFrame for downloading
 */
function initFrame(urls) {
    if (typeof urls != 'string') urls = urls.join('|');
    var iFrame = $('iframe#douban-offline');
    if (!iFrame.length) {
        var src = 'http://otho.douban.com/' + ( urls ? '#' + urls : '' );
        iFrame = $('<iframe></iframe>');
        iFrame.attr('src', src).attr('id', 'douban-offline')
              .css({ 'display': 'none' }).appendTo($('body'));
    }
    // console.log(iFrame.attr('src'));
    return iFrame;
}

/* Creates a string of all URLs of media files on the page that will be 
 * captured.  String is separated by | character
 */
function getImageLinks() {
    // const faviconUrl = 'http://lotho.douban.com/favicon.ico';
    const reFullPath = /^http:\/\/otho\.douban\.com\/.*/;
    const reAbsolutePath = /^\/.*\.(jpg|gif|png)$/;

    var imgTags = $('img');
    var imgUrls = [];

    $.each(imgTags, function() {
        var imgSrc = $(this).attr('src');
        if (reFullPath.test(imgSrc)) {
            push(imgSrc, imgUrls);
        } else if (reAbsolutePath.test(imgSrc)) {
            push(host + imgSrc, imgUrls);
        }
    });
    // imgUrls = imgUrls.join('|');
    return imgUrls;
}

/* Creates an array of all CSS file URLs on the page that will be captured
 */
function getStyleLinks() {
    const reAbsolutePath = /^\/.*\.css$/;

    var cssTags = $('link[rel="stylesheet"]');
    var cssUrls = [];

    $.each(cssTags, function() {
        var cssHref = $(this).attr('href');
        if (reAbsolutePath.test(cssHref)) {
            push(host + cssHref, cssUrls);
        }
    });
    // cssUrls = cssUrls.join('|');
    return cssUrls;
}

/* Creates an array of all Javascript file URLs on the page that will be captured
 */
function getScriptLinks() {
    const reAbsolutePath = /^\/.*\.js$/;

    var jsTags = $('script[src]');
    var jsUrls = [];

    $.each(jsTags, function() {
        var jsSrc = $(this).attr('src');
        if (reAbsolutePath.test(jsSrc)) {
            push(host + jsSrc, jsUrls);
        }
    });
    // jsUrls = jsUrls.join('|');
    return jsUrls;
}

function getExternalLinks() {
    var doubanUrls = [ location.href ];
    var othoUrls = [];

    doubanUrls = doubanUrls.concat(getStyleLinks(), getScriptLinks());
    $.each(getImageLinks(), function() {
        if (isDouban(this)) doubanUrls.push(this.toString());
        else othoUrls.push(this.toString());
    });
    return { 'doubanUrls': doubanUrls, 'othoUrls': othoUrls }
}

function addLoadEvent(func) {
    var oldonload = unsafeWindow.onload;
    if (typeof unsafeWindow.onload != 'function') {
        unsafeWindow.onload = func;
    } else {
        unsafeWindow.onload = function() {
            if (oldonload) oldonload();
            func();
        };
    }
}

function push(item, array) {
    if ($.inArray(item, array) == -1) array.push(item);
}

/* Capture specified page
 */
function capturePage(url) {
    if (store.isCaptured(url)) {
        // is captured
        console.log("URL: " + url + ", is captured");
    } else {
        urls = [ location.href ];
        $.extend(urls, getExternalLinks());
    }
}

/* Capture cross origin page by iframe
 */
function captureExternal(url) {

}

/* Capture page directly
 */
function capture(url) {
    try {
        store.capture(url, function(url, success, captureId) {
            console.log("URL: " + url + ", " + ( success ? "" : "not " ) +
                        "captured by ID " + captureId)
        });
    } catch(e) {
        console.log("Cannot find store: " + e.message);
    }
}

/* End of general functions
 * }}} */

/* {{{ === Main entry ===  
 */
if (isMedia(location.href)) {
    // console.log('Goes here');
    addLoadEvent(initOthoGM);
} else {
    addLoadEvent(initDoubanGM);
}
/* }}} */

/* {{{ === Debug ===
 */
function debug() {
    /* Test for get external links 
    console.log(getImageLinks());                           // ...Passed
    console.log(getStyleLinks());                           // ...Passed
    console.log(getScriptLinks());                          // ...Passed
    console.log(getExternalLinks().doubanUrls);             // ...Passed
    console.log(getExternalLinks().othoUrls);               // ...Passed
     */

    /* Test for same origin resources
    capture(getExternalLinks().doubanUrls); 
    */

    /* Test for cross origin resources
    var testUrl = "http://otho.douban.com/mpic/s3181630.jpg";
    $('body').append('<iframe id="grabPicture" src="http://otho.douban.com/"></iframe>');
    $('#grabPicture').src = testUrl;
    capture(testUrl);
     */
}
/* {{{ */
