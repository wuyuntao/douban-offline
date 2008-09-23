// {{{ === License and metadata ===  
// Douban Offline
// A Greasemonkey script allows you to use douban offline and backup your collections
// version 0.2
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
const doubanTypeDict = {
    all: { id: 'all', name: '全部',
           regex: /^$/
    },
    subject: { id: 'subject', name: '条目',
               regex: /^http:\/\/www\.douban\.com\/subject\/.*/
    },
    group: { id: 'group', name: '小组',
             regex: /^http:\/\/www\.douban\.com\/group\/.*/
    },
    people: { id: 'people', name: '用户',
              regex: /^http:\/\/www\.douban\.com\/people\/.*/
    },
    note: { id: 'note', name: '日记',
            regex: /^http:\/\/www\.douban\.com\/note\/.*/
    },
    photo: { id: 'photo', name: '相册',
            regex: /^http:\/\/www\.douban\.com\/photos\/.*/
    },
};

const doubanOfflineStyle = 
    "#douban-offline-status { margin: 0 20px 3px; border: 1px solid #d5f5d5; border-width: 0 2px 2px; -moz-border-radius-bottomright: 8px; -moz-border-radius-bottomleft: 8px; } " + 
    "#douban-offline-status h2 { padding: 2px 20px; margin: 0; border-bottom: 2px solid #eef9eb; }" +
    "#douban-offline-type-list { text-align: left; display: block; float: left; width: 5%; margin: 5px 0 30px 15px; }" +
    "#douban-offline-type-list .current { font-weight: bold; }" +
    "#douban-offline-link-table { display: block; float: right; width: 92%; margin: 3px; }" +
    "#douban-offline-link-table th { font-weight: bold; text-align: center; background: #eef9eb }" +
    "#douban-offline-link-table th.id { width: 4%; }" +
    "#douban-offline-link-table th.title { width: 50%; }" +
    "#douban-offline-link-table th.url { width: 32%; }" +
    "#douban-offline-link-table th.type { width: 8%; }" +
    "#douban-offline-link-table th.delete { width: 4%; }" +
    "#douban-offline-link-table td.id { width: 4%; text-align: left; }" +
    "#douban-offline-link-table td.title { width: 50%; overflow-x: hidden; }" +
    "#douban-offline-link-table td.url { width: 32%; overflow-x: hidden; }" +
    "#douban-offline-link-table td.type { width: 8%; text-align: center; }" +
    "#douban-offline-link-table td.delete { width: 4%; text-align: center; }" +
    "#douban-offline-status span.button { cursor: pointer; color: #336699; text-decoration: underline; }" +
    "#douban-offline-capture, #douban-toggle-offline { display: block; float: right; margin: 3px; }" +
    ""
;

// Gears
var server = null;
var store = null;
var db = null;
var workerPoll = null;

// Browser
var console = unsafeWindow.console || { log: function() {} };
/* }}} */

/* {{{ === Initialization ===  
 * ``initOffline`` for most pages
 * ``initControl`` for the control iframe
 * ``initDoubanGears`` for the download iframe for www.douban.com
 * ``initOthoGears`` for the download iframe for otho.douban.com
 * ``initGears`` used by ``initDoubanGears`` and ``initOthoGears``
 */
function initOffline() {
    window.$G = new initGears();
    createOfflineStatus();
    addOfflineButton();
    if (!server) {
        triggerAllowDoubanDialog();
    } else {
        // disableStore();
        console.log('Douban offline initialized');
    }
}

function initControl() {
    var url = location.href.match(/(.*)#douban_offline_control$/)[1]; 
    window.$G = new initGears();
    if (!server) {
        triggerAllowDoubanDialog();
    } else {
        console.log("Start capturing page. URL: " + url);
        capturePage(document.title, url);
    }
    console.log('Douban control initialized');
}

function initDoubanGears() {
    window.$G = new initGears();
    if (!server) {
        triggerAllowDoubanDialog();
    } else {
        console.log('Douban gears initialized');
        var doubanUrls = location.href.split('#')[1];
        var urls = doubanUrls.split('|');
        capture(urls);
    }
}

function initOthoGears() {
    window.$G = new initGears();
    if (!server) {
        triggerAllowOthoDialog();
    } else {
        console.log('Otho gears initialized');
        var othoUrls = location.href.split('#')[1];
        var urls = othoUrls.split("|");
        capture(urls);
    }
}

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
                ' (Title VARCHAR(255), URL VARCHAR(255), Type VARCHAR(255), TransactionID INT)');
        }
    } catch(e) {
        console.log("Problem in initializing database: " + e.message);
    }
    return unsafeWindow.google.gears;
}

/* }}} */

/* {{{ === Page check ===  
 * ``isControl`` for the control iframe
 * ``isDoubanGears`` for the download iframe for www.douban.com
 * ``isOthoGears`` for the download iframe for otho.douban.com
 */
/* Check if the current frame is control
 */
function isControl(url) {
    return /www\.douban\.com.*#douban_offline_control$/.test(url);
}

/* Check if the current page is www.douban.com origin
 */
function isDouban(url) {
    return /www\.douban\.com.*#douban_offline_download$/.test(url);
}

function isOtho(url) {
    return /otho\.douban\.com.*#douban_offline_download$/.test(url);
}
/* }}} */

/* {{{ === Permission dialog trigger ===  
 * ``triggerAllowDoubanDialog`` is called if the user hasn't allowed
 * www.douban.com to use Gears
 * ``triggerAllowOthoDialog`` is called if the user hasn't allowed
 * otho.douban.com to use Gears
 */
function triggerAllowDoubanDialog() {
    window.addEventListener("load", function() {
        $G.factory.create('beta.localserver', '1.0');
        location.href = location.href;
        return false;
    }, true);
}

function triggerAllowOthoDialog() {
    window.addEventListener("load", function() {
        $G.factory.create('beta.localserver', '1.0');
        return false;
    }, true);
}
/* }}} */

/* {{{ === Iframe initialization ===  
/* ``initControlFrame`` initializes iframe for control downloads
/* ``initDoubanFrame`` initializes iframe for downloads on www.douban.com
/* ``initOthoFrame`` initializes iframe for downloads on otho.douban.com
 * ``initFrame`` used by ``initDoubanFrame`` and ``initOthoFrame``
 */
function initControlFrame(doubanUrl) {
    return initFrame('offline-control', doubanUrl);
}

function initDoubanFrame(downloadUrls) {
    return initFrame('douban-offline', 'http://www.douban.com/douban_offline/',
                     downloadUrls);
}

function initOthoFrame(downloadUrls) {
    return initFrame('otho-offline', 'http://otho.douban.com/douban_offline/',
                     downloadUrls);
}

function initFrame(frameId, frameUrl, downloadUrls) {
    if (downloadUrls && typeof downloadUrls != 'string')
        downloadUrls = downloadUrls.join('|');
    var iFrame = $('#' + frameId);
    if (!iFrame.length) {
        iFrame = $('<iframe></iframe>');
        iFrame.attr('id', frameId).attr('name', frameId)
              .css({ 'display': 'none' }).appendTo($('body'));
    }
    var src = frameUrl + ( downloadUrls ? '#' + downloadUrls + '#douban_offline_download' : '' );
    iFrame.attr('src', src);
    // console.log(iFrame.attr('src'));
    return iFrame;
}

/* }}} */

/* {{{ === Link parser ===  
 */
var cssImageUrls = [
    '/pics/discover.jpg',
    '/pics/topicbar.gif',
    '/pics/headnavbot.gif',
    '/pics/headnavback.gif',
    '/pics/search.gif',
    '/pics/graybutt.gif',
    '/pics/redbutt.gif',
    '/pics/zbar.gif',
    '/pics/wztab.gif',
    '/pics/ibox.gif',
    '/pics/tablev.gif',
    '/pics/tableh.gif',
    '/pics/quotel.gif',
    '/pics/quoter.gif',
    '/pics/listdot.gif',
    '/pics/stars.gif',
    '/pics/arrowright.gif',
    '/pics/topicgrey.gif',
    '/pics/albumback.gif',
    '/pics/albumback_s.gif',
    '/pics/video_overlay.png',
    '/pics/feed1.png',
    '/pics/collect_back.png'
];
for (var i = 0, len = cssImageUrls.length; i < len; i++) {
    cssImageUrls[i] = 'http://www.douban.com' + cssImageUrls[i];
}

function getLinks() {
    var doubanUrls = [ location.href ];
    var othoUrls = [];

    doubanUrls = doubanUrls.concat(cssImageUrls, getStyleLinks(), getScriptLinks());
    $.each(getImageLinks(), function() {
        if (/www\.douban\.com/.test(this)) doubanUrls.push(this.toString());
        else othoUrls.push(this.toString());
    });
    return { 'doubanUrls': doubanUrls, 'othoUrls': othoUrls }
}

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
/* }}} */

/* === {{{ Page capture ===  
 */
function capturePage(title, url, force) {
    if (store.isCaptured(url) && force != true) {
        // is captured
        console.log("URL: " + url + " is already captured");
    } else {
        var urls = getLinks();
        initDoubanFrame(urls.doubanUrls);
        initOthoFrame(urls.othoUrls);
        saveInDatabase(title, url);
    }
}

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
/* }}} */

/* {{{ === Store opertions ===  
 */
function enableStore() {
    try {
        store.enabled = true;
    } catch(e) {
        console.log('Failed to enable store');
    }
}

function disableStore() {
    try {
        store.enabled = false;
    } catch(e) {
        console.log('Failed to disable store');
    }
}

function isOffline() {
    return store.enabled == true;
}

function saveInDatabase(title, url) {
    var maxId = 0;
    var rowId = null;
    var type = getType(url);
    // Update entry
    try {
        var rs = db.execute('SELECT TransactionID, URL FROM DoubanOffline ' +
                            'WHERE URL = ?',
                            [url]);
        if (rs.isValidRow()) {
            rowId = rs.field(0);
            try {
                var ss = db.execute('UPDATE DoubanOffline SET Title = ? ' +
                                    'WHERE TransactionID = ?',
                                    [title, rowId]);
                return rowId;
            } catch(e) {
                console.log('Failed to update record in Database');
            } finally {
                ss.close();
            }
        }
    } finally {
        rs.close();
    }

    // Save in new entry
    try {
        var rs = db.execute('SELECT MAX(TransactionID) FROM DoubanOffline');
        if (rs.isValidRow() && rs.field(0) != null) {
            maxId = rs.field(0);
        }
    } finally {
        rs.close()
    }
    maxId++;

    console.log("<[" + type + "] " + title + ": \"" + url +
                "\"> saved in transaction ID: " + maxId);
    var rs = db.execute('INSERT INTO DoubanOffline VALUES (?, ?, ?, ?)',
        [title, url, type, maxId]);
    try {
        rs = db.execute('SELECT MAX(rowid) from DoubanOffline');
        if (rs.isValidRow()) {
            rowId = rs.field(0);
        }
    } finally {
        rs.close();
    }
    return rowId;
}

function getByType(type, start, limit) {
    var results = []
    try {
        if (type == 'all') {
            var rs = db.execute('SELECT * FROM DoubanOffline ORDER BY TransactionID DESC ' +
                                'LIMIT ? OFFSET ?',
                                [limit, start]);
        } else {
            var rs = db.execute('SELECT * FROM DoubanOffline WHERE Type = ? ' +
                                'ORDER BY TransactionID DESC LIMIT ? OFFSET ?',
                                [type, limit, start]);
        }
        while (rs.isValidRow()) {
            var result = { title: rs.field(0), url: rs.field(1),
                           type: rs.field(2), id: rs.field(3) };
            // console.log(result);
            results.push(result);
            rs.next();
        }
    } finally {
        rs.close();
    }
    return results;
}

function deleteById(id) {
    try {
        var rs = db.execute('SELECT TransactionID, URL FROM DoubanOffline ' +
                            'WHERE TransactionID = ?',
                            [id]);
        while (rs.isValidRow()) {
            store.remove(rs.field(1));
            rs.next();
        }
    } catch(e) {
        console.log('Failed to delete from the store, ID: ' + id);
    } finally {
        rs.close();
    } 

    try {
        var ss = db.execute('DELETE FROM DoubanOffline WHERE TransactionID = ?',
                            [id]);
        console.log('Resource deleted, ID:' + id);
    } catch(e) {
        console.log('Failed to delete from the database, ID: ' + id);
    } finally {
        ss.close();
    }
}
/* }}} */

/* {{{ === User interface ===  
 */
function addOfflineButton() {
    var button = $('<a id="douban-offline-button">离线</a>');
    button.css({ 'cursor': 'pointer' });
    button.click(function() {
        toggleOfflineStatus();
        return false;
    });
    $('#status').append(button);
}

function toggleOfflineStatus() {
    var offlineStatus = $('#douban-offline-status');
    offlineStatus.slideToggle('normal');
}

function hideOfflineStatus() {
    $('#douban-offline-status').slideUp('normal');
}

function createOfflineStatus() {
    var style = $('<style type="text/css"></style');
    var wrapper = $('<div id="douban-offline-status"></div>');
    var title = $('<h2>豆瓣离线</h2>');
    var insideWrapper = $('<div></div>');
    var captureButton = new drawCaptureButton();
    var toggleOfflineButton = new drawToggleOfflineButton();
    var typeListWrapper = new drawTypeList();
    var linkTableWrapper = new drawLinkTable('all');

    insideWrapper.append(typeListWrapper).append(linkTableWrapper)
                 .append('<div class="clear"></div>')
    wrapper.append(captureButton).append(toggleOfflineButton)
           .append(title).append(insideWrapper)
           .insertAfter($('#status')).hide();
    style.html(doubanOfflineStyle).insertBefore(wrapper);
}

function drawToggleOfflineButton() {
    var button = $('<span id="douban-toggle-offline" class="button"></span>');
    if (isOffline()) {
        button.html('在线浏览');
    } else {
        button.html('离线浏览');
    }
    button.click(function() {
        isOffline() ? disableStore() : enableStore();
        location.href = location.href;
    });
    return button;
}

function drawCaptureButton() {
    var force = store.isCaptured(location.href.toString());
    var button = $('<span id="douban-offline-capture" class="button"></span>');
    if (force) button.html('更新此页面');
    else button.html('收藏此页面');
    button.click(function() {
        capturePage(document.title, location.href.toString(), force);
    });
    return button
}

function drawTypeList() {
    var list = $('<ul id="douban-offline-type-list"></ul>');
    $.each(doubanTypeDict, function() {
        var type = this.id;
        var item = $('<li></li>');
        var link = $('<span></span>');
        link.attr('id', 'douban-offline-type-' + type)
            .attr('class', 'button ' + (type == 'all' ? 'current' : ''))
            .html(this.name);
        link.click(function() {
            drawLinkTable(type);
            $('#douban-offline-type-list span.current').removeClass('current');
            $(this).addClass('current');
        });
        item.append(link).appendTo(list);
    });
    return list;
}

function drawLinkTable(type) {
    var results = getByType(type, 0, 10);
    var table = $('#douban-offline-link-table');
    if (!table.length) {
        var table = $('<table id="douban-offline-link-table"><tbody></tbody></table>');
        table.append($('<tr><th class="id">ID</th><th class="title">标题</th><th class="url">链接</th><th class="type">类别</th><th class="delete">删除</th></tr>'));
    }
    table.find('tr:gt(0)').remove();
    $.each(results, function() {
        var itemId = this.id;
        var itemType = this.type;
        var item = $('<tr id="douban-offline-link-' + itemId + '"></tr>');
        item.append('<td class="id">' + itemId + '</td>')
            .append('<td class="title">' + this.title + '</td>')
            .append('<td class="url"><a href="' + this.url + '">' + this.url + '</a></td>')
            .append('<td class="type">' + doubanTypeDict[itemType].name + '</td>')
            .append('<td class="delete"><span class="button douban-offline-delete">删除</span></td>')
            .attr('id', 'douban-offline-' + itemId)
            .attr('class', 'douban-offline-link')
            .appendTo(table);

        var deleteButton = item.find('span.douban-offline-delete');
        deleteButton.click(function() {
            deleteById(itemId);
            drawLinkTable(type);
        });
    });
    table.find('tr:even').css({ 'background': '#f4fff1' });
    return table;
}

/* }}} */

/* {{{ === General functions ===  
 */
function getType(url) {
    var type = 'all'
    $.each(doubanTypeDict, function() {
        if (this.regex.test(url)) type = this.id;
    });
    return type;
}

function push(item, array) {
    if ($.inArray(item, array) == -1) array.push(item);
}
/* }}} */

/* {{{ === Main entry ===  
 */
$(function() {
    var url = location.href;
    if (isControl(url)) initControl();
    else if (isDouban(url)) initDoubanGears();
    else if (isOtho(url)) initOthoGears();
    else initOffline();
});
/* }}} */
// vim: set foldmethod=marker
