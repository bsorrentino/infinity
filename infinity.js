//     (c) 2012 Airbnb, Inc.
//
//     infinity.js may be freely distributed under the terms of the BSD
//     license. For all licensing information, details, and documentation:
//     http://airbnb.github.com/infinity
//
// RUN > tsc --declaration infinity.ts typings/jquery/jquery.d.ts TO EXTRACT DEFINITION
/// <reference path="typings/tsd.d.ts"/>
var Config = (function () {
    function Config() {
    }
    return Config;
})();
var TSInfinity = (function () {
    function TSInfinity() {
        this.config = new Config;
    }
    return TSInfinity;
})();
!function (window, Math, $) {
    'use strict';
    var $window = $(window);
    var infinity = new TSInfinity;
    var oldInfinity = window.infinity;
    window.infinity = infinity;
    var config = infinity.config;
    var PAGE_ID_ATTRIBUTE = 'data-infinity-pageid', NUM_BUFFER_PAGES = 1, PAGES_ONSCREEN = NUM_BUFFER_PAGES * 2 + 1;
    config.PAGE_TO_SCREEN_RATIO = 3;
    config.SCROLL_THROTTLE = 350;
    function ListView($el, options) {
        options = options || {};
        this.$el = blankDiv();
        this.$shadow = blankDiv();
        $el.append(this.$el);
        this.lazy = !!options.lazy;
        this.lazyFn = options.lazy || null;
        this.useElementScroll = options.useElementScroll === true;
        initBuffer(this);
        this.top = this.$el.offset().top;
        this.width = 0;
        this.height = 0;
        this.pages = [];
        this.startIndex = 0;
        this.$scrollParent = this.useElementScroll ? $el : $window;
        DOMEvent.attach(this);
    }
    function initBuffer(listView) {
        listView._$buffer = blankDiv().prependTo(listView.$el);
    }
    function updateBuffer(listView) {
        var firstPage, pages = listView.pages, $buffer = listView._$buffer;
        if (pages.length > 0) {
            firstPage = pages[listView.startIndex];
            $buffer.height(firstPage.top);
        }
        else {
            $buffer.height(0);
        }
    }
    ListView.prototype.append = function (obj) {
        if (!obj || !obj.length)
            return null;
        var lastPage, item = convertToItem(this, obj), pages = this.pages;
        this.height += item.height;
        this.$el.height(this.height);
        lastPage = pages[pages.length - 1];
        if (!lastPage || !lastPage.hasVacancy()) {
            lastPage = new Page(this);
            pages.push(lastPage);
        }
        lastPage.append(item);
        insertPagesInView(this);
        return item;
    };
    ListView.prototype.prepend = function (obj) {
        if (!obj || !obj.length)
            return null;
        var firstPage, item = convertToItem(this, obj, true), pages = this.pages;
        this.height += item.height;
        this.$el.height(this.height);
        firstPage = pages[0];
        if (!firstPage || !firstPage.hasVacancy()) {
            firstPage = new Page(this);
            this.startIndex++;
            pages.splice(0, 0, firstPage);
        }
        updatePagePosition(pages, item.height, 1);
        firstPage.prepend(item);
        updateStartIndex(this, true);
        return item;
    };
    function updatePagePosition(pages, positionChange, offset) {
        var length = pages.length, i, page;
        for (i = offset || 0; i < length; i++) {
            page = pages[i];
            page.top += positionChange;
            page.bottom += positionChange;
            updateItemPosition(page.items, positionChange);
        }
    }
    ;
    function updateItemPosition(items, positionChange, offset) {
        if (offset === void 0) { offset = 0; }
        var length = items.length, i, item;
        for (i = offset || 0; i < length; i++) {
            item = items[i];
            item.top += positionChange;
            item.bottom += positionChange;
        }
    }
    ;
    function cacheCoordsFor(listView, listItem, prepend) {
        listItem.$el.detach();
        if (prepend) {
            listView.$el.prepend(listItem.$el);
        }
        else {
            listView.$el.append(listItem.$el);
        }
        updateCoords(listItem, prepend ? 0 : listView.height);
        listItem.$el.detach();
    }
    function insertPagesInView(listView) {
        var index, length, curr, pages = listView.pages, inserted = false, inOrder = true;
        index = listView.startIndex;
        length = Math.min(index + PAGES_ONSCREEN, pages.length);
        for (index; index < length; index++) {
            curr = pages[index];
            if (listView.lazy)
                curr.lazyload(listView.lazyFn);
            if (inserted && curr.onscreen)
                inOrder = false;
            if (!inOrder) {
                curr.stash(listView.$shadow);
                curr.appendTo(listView.$el);
            }
            else if (!curr.onscreen) {
                inserted = true;
                curr.appendTo(listView.$el);
            }
        }
    }
    function updateStartIndex(listView, prepended) {
        var index, length, pages, lastIndex, nextLastIndex, startIndex = listView.startIndex, viewRef = listView.$scrollParent, viewTop = viewRef.scrollTop() - listView.top, viewHeight = viewRef.height(), viewBottom = viewTop + viewHeight, nextIndex = startIndexWithinRange(listView, viewTop, viewBottom);
        if (nextIndex < 0 || (nextIndex === startIndex && !prepended))
            return startIndex;
        pages = listView.pages;
        startIndex = listView.startIndex;
        lastIndex = Math.min(startIndex + PAGES_ONSCREEN, pages.length);
        nextLastIndex = Math.min(nextIndex + PAGES_ONSCREEN, pages.length);
        for (index = startIndex, length = lastIndex; index < length; index++) {
            if (index < nextIndex || index >= nextLastIndex)
                pages[index].stash(listView.$shadow);
        }
        listView.startIndex = nextIndex;
        insertPagesInView(listView);
        updateBuffer(listView);
        return nextIndex;
    }
    ListView.prototype.remove = function () {
        this.$el.remove();
        this.cleanup();
    };
    function convertToItem(listView, possibleItem, prepend) {
        var item;
        if (possibleItem instanceof ListItem)
            return possibleItem;
        if (typeof possibleItem === 'string')
            possibleItem = $(possibleItem);
        item = new ListItem(possibleItem);
        cacheCoordsFor(listView, item, prepend);
        return item;
    }
    function tooSmall(listView, page) {
        repartition(listView);
    }
    function repartition(listView) {
        var currPage, newPage, index, length, itemIndex, pageLength, currItems, currItem, nextItem, pages = listView.pages, newPages = [];
        newPage = new Page(listView);
        newPages.push(newPage);
        for (index = 0, length = pages.length; index < length; index++) {
            currPage = pages[index];
            currItems = currPage.items;
            for (itemIndex = 0, pageLength = currItems.length; itemIndex < pageLength; itemIndex++) {
                currItem = currItems[itemIndex];
                nextItem = currItem.clone();
                if (newPage.hasVacancy()) {
                    newPage.append(nextItem);
                }
                else {
                    newPage = new Page(listView);
                    newPages.push(newPage);
                    newPage.append(nextItem);
                }
            }
            currPage.remove();
        }
        listView.pages = newPages;
        insertPagesInView(listView);
    }
    ListView.prototype.find = function (findObj) {
        var items, $onscreen, $offscreen;
        if (typeof findObj === 'string') {
            $onscreen = this.$el.find(findObj);
            $offscreen = this.$shadow.find(findObj);
            return this.find($onscreen).concat(this.find($offscreen));
        }
        if (findObj instanceof ListItem)
            return [
                findObj
            ];
        items = [];
        findObj.each(function () {
            var pageId, page, pageItems, index, length, currItem, $itemEl = $(this).parentsUntil('[' + PAGE_ID_ATTRIBUTE + ']').andSelf().first(), $pageEl = $itemEl.parent();
            pageId = $pageEl.attr(PAGE_ID_ATTRIBUTE);
            page = PageRegistry.lookup(pageId);
            if (page) {
                pageItems = page.items;
                for (index = 0, length = pageItems.length; index < length; index++) {
                    currItem = pageItems[index];
                    if (currItem.$el.is($itemEl)) {
                        items.push(currItem);
                        break;
                    }
                }
            }
        });
        return items;
    };
    function startIndexWithinRange(listView, top, bottom) {
        var index = indexWithinRange(listView, top, bottom);
        index = Math.max(index - NUM_BUFFER_PAGES, 0);
        index = Math.min(index, listView.pages.length);
        return index;
    }
    function indexWithinRange(listView, top, bottom) {
        var index, length, curr, startIndex, midpoint, diff, prevDiff, pages = listView.pages, rangeMidpoint = top + (bottom - top) / 2;
        startIndex = Math.min(listView.startIndex + NUM_BUFFER_PAGES, pages.length - 1);
        if (pages.length <= 0)
            return -1;
        curr = pages[startIndex];
        midpoint = curr.top + curr.height / 2;
        prevDiff = rangeMidpoint - midpoint;
        if (prevDiff < 0) {
            for (index = startIndex - 1; index >= 0; index--) {
                curr = pages[index];
                midpoint = curr.top + curr.height / 2;
                diff = rangeMidpoint - midpoint;
                if (diff > 0) {
                    if (diff < -prevDiff)
                        return index;
                    return index + 1;
                }
                prevDiff = diff;
            }
            return 0;
        }
        else if (prevDiff > 0) {
            for (index = startIndex + 1, length = pages.length; index < length; index++) {
                curr = pages[index];
                midpoint = curr.top + curr.height / 2;
                diff = rangeMidpoint - midpoint;
                if (diff < 0) {
                    if (-diff < prevDiff)
                        return index;
                    return index - 1;
                }
                prevDiff = diff;
            }
            return pages.length - 1;
        }
        return startIndex;
    }
    ListView.prototype.cleanup = function () {
        var pages = this.pages, page;
        DOMEvent.detach(this);
        while (page = pages.pop()) {
            page.cleanup();
        }
    };
    var DOMEvent = (function () {
        var eventIsBound = false, scrollScheduled = false, resizeTimeout = null, boundViews = [];
        function scrollHandler() {
            if (!scrollScheduled) {
                setTimeout(scrollAll, config.SCROLL_THROTTLE);
                scrollScheduled = true;
            }
        }
        function scrollAll() {
            var index, length;
            for (index = 0, length = boundViews.length; index < length; index++) {
                updateStartIndex(boundViews[index]);
            }
            scrollScheduled = false;
        }
        function resizeHandler() {
            if (resizeTimeout)
                clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(resizeAll, 200);
        }
        function resizeAll() {
            var index, curr;
            for (index = 0; curr = boundViews[index]; index++) {
                repartition(curr);
            }
        }
        return {
            attach: function (listView) {
                if (!listView.eventIsBound) {
                    listView.$scrollParent.on('scroll', scrollHandler);
                    listView.eventIsBound = true;
                }
                if (!eventIsBound) {
                    $window.on('resize', resizeHandler);
                    eventIsBound = true;
                }
                boundViews.push(listView);
            },
            detach: function (listView) {
                var index, length;
                if (listView.eventIsBound) {
                    listView.$scrollParent.on('scroll', scrollHandler);
                    listView.eventIsBound = false;
                }
                for (index = 0, length = boundViews.length; index < length; index++) {
                    if (boundViews[index] === listView) {
                        boundViews.splice(index, 1);
                        if (boundViews.length === 0) {
                            $window.off('resize', resizeHandler);
                            eventIsBound = false;
                        }
                        return true;
                    }
                }
                return false;
            }
        };
    }());
    function Page(parent) {
        this.parent = parent;
        this.items = [];
        this.$el = blankDiv();
        this.id = PageRegistry.generatePageId(this);
        this.$el.attr(PAGE_ID_ATTRIBUTE, this.id);
        this.top = 0;
        this.bottom = 0;
        this.width = 0;
        this.height = 0;
        this.lazyloaded = false;
        this.onscreen = false;
    }
    Page.prototype.append = function (item) {
        var items = this.items;
        if (items.length === 0)
            this.top = item.top;
        this.bottom = item.bottom;
        this.width = this.width > item.width ? this.width : item.width;
        this.height = this.bottom - this.top;
        items.push(item);
        item.parent = this;
        this.$el.append(item.$el);
        this.lazyloaded = false;
    };
    Page.prototype.prepend = function (item) {
        var items = this.items;
        this.bottom += item.height;
        this.width = this.width > item.width ? this.width : item.width;
        this.height = this.bottom - this.top;
        items.splice(0, 0, item);
        item.parent = this;
        this.$el.prepend(item.$el);
        this.lazyloaded = false;
    };
    Page.prototype.hasVacancy = function () {
        var viewRef = this.parent.$scrollParent;
        return this.height < viewRef.height() * config.PAGE_TO_SCREEN_RATIO;
    };
    Page.prototype.appendTo = function ($el) {
        if (!this.onscreen) {
            this.$el.appendTo($el);
            this.onscreen = true;
        }
    };
    Page.prototype.prependTo = function ($el) {
        if (!this.onscreen) {
            this.$el.prependTo($el);
            this.onscreen = true;
        }
    };
    Page.prototype.stash = function ($el) {
        if (this.onscreen) {
            this.$el.appendTo($el);
            this.onscreen = false;
        }
    };
    Page.prototype.remove = function () {
        if (this.onscreen) {
            this.$el.detach();
            this.onscreen = false;
        }
        this.cleanup();
    };
    Page.prototype.cleanup = function () {
        var items = this.items, item;
        this.parent = null;
        PageRegistry.remove(this);
        while (item = items.pop()) {
            item.cleanup();
        }
    };
    Page.prototype.lazyload = function (callback) {
        var $el = this.$el, index, length;
        if (!this.lazyloaded) {
            for (index = 0, length = $el.length; index < length; index++) {
                callback.call($el[index], $el[index]);
            }
            this.lazyloaded = true;
        }
    };
    var PageRegistry = (function () {
        var pages = [];
        return {
            generatePageId: function (page) {
                return pages.push(page) - 1;
            },
            lookup: function (id) {
                return pages[id] || null;
            },
            remove: function (page) {
                var id = page.id;
                if (!pages[id])
                    return false;
                pages[id] = null;
                return true;
            }
        };
    }());
    function removeItemFromPage(item, page) {
        var index, length, foundIndex, items = page.items;
        for (index = 0, length = items.length; index < length; index++) {
            if (items[index] === item) {
                foundIndex = index;
                break;
            }
        }
        if (foundIndex == null)
            return false;
        items.splice(foundIndex, 1);
        page.bottom -= item.height;
        page.height = page.bottom - page.top;
        if (page.hasVacancy())
            tooSmall(page.parent, page);
        return true;
    }
    function ListItem($el) {
        this.$el = $el;
        this.parent = null;
        this.top = 0;
        this.bottom = 0;
        this.width = 0;
        this.height = 0;
    }
    ListItem.prototype.clone = function () {
        var item = new ListItem(this.$el);
        item.top = this.top;
        item.bottom = this.bottom;
        item.width = this.width;
        item.height = this.height;
        return item;
    };
    ListItem.prototype.remove = function () {
        this.$el.remove();
        removeItemFromPage(this, this.parent);
        this.cleanup();
    };
    ListItem.prototype.cleanup = function () {
        this.parent = null;
    };
    function updateCoords(listItem, yOffset) {
        var $el = listItem.$el;
        listItem.top = yOffset;
        listItem.height = $el.outerHeight(true);
        listItem.bottom = listItem.top + listItem.height;
        listItem.width = $el.width();
    }
    function blankDiv() {
        return $('<div>').css({
            margin: 0,
            padding: 0,
            border: 'none'
        });
    }
    infinity.ListView = ListView;
    infinity.Page = Page;
    infinity.ListItem = ListItem;
    function registerPlugin(infinity) {
        var ListView;
        if (infinity) {
            ListView = infinity.ListView;
            $.fn.listView = function (options) {
                return new ListView(this, options);
            };
        }
        else {
            delete $.fn.listView;
        }
    }
    registerPlugin(infinity);
    infinity.noConflict = function () {
        window.infinity = oldInfinity;
        registerPlugin(oldInfinity);
        return infinity;
    };
}(window, Math, jQuery);
