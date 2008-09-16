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
// ==/UserScript==
//
// }}}

/* {{{ === Global variables ===  
 */
var console = unsafeWindow.console || { log: function() {} };

var server = null;
var store = null;
var db = null;
var workerPoll = null;

var imgLinks = null;

/* End of global varaible definitions
 * }}} */

/* {{{ === Douban functions ===  
 * Initialize jQuery and Gears for www.douban.com
 */
function initDoubanGM() {
    if (typeof unsafeWindow.jQuery != 'undefined') 
        window.$ = unsafeWindow.jQuery;
    window.$G = new initGears();
    if (!server) {
        triggerAllowDoubanDialog();
    } else {
        // Do something ...
    }
}

/* Check if the current page is www.douban.com origin
 */
function isDouban() {
    return (location.href.indexOf('www.douban.com') != -1)
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
    if (typeof unsafeWindow.jQuery != 'undefined') 
        window.$ = unsafeWindow.jQuery;
    window.$G = new initGears();
    if (!server) {
        triggerAllowOthoDialog();
    } else {
        // Do something ...
    }
}

/* Check if the current page is www.douban.com origin
 */
function isMedia() {
    return (location.href.indexOf('otho.douban.com') != -1)
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
            unsafeWindow.google.gears = { factory: new GearsFactory() };
        } catch(e) {
            alert("Problem in initializing Gears: " + e.message)
        }
    }
    try {
        server = unsafeWindow.google.gears.factory.create('beta.localserver');
        store = server.creatStore('douban_offline');
        db = unsafeWindow.google.gears.factory.create('beta.database');
        if (db) {
            db.open('douban_offline');
            db.execute('CREATE TABLE IF NOT EXISTS DoubanOffline' +
                       ' (Content VARCHAR(255), URL VARCHAR(255), TransactionID INT)');
        }
    } catch(e) {
        // Error log
    }
    return unsafeWindow.google.gears;
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

/* End of general functions
 * }}} */

/* {{{ === Main entry ===  
 */
if (isMedia()) {
    addLoadEvent(initOthoGM);
} else {
    addLoadEvent(initDoubanGM);
}
/* }}} */
