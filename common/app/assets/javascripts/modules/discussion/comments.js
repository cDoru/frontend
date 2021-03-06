define([
    'utils/ajax',
    'bonzo',
    'qwery',
    'modules/component',
    'modules/identity/api',
    'modules/discussion/comment-box',
    'modules/discussion/recommend-comments',
    'modules/discussion/api',
    '$'
], function(
    ajax,
    bonzo,
    qwery,
    Component,
    Id,
    CommentBox,
    RecommendComments,
    DiscussionApi,
    $
) {

/**
 * TODO (jamesgorrie):
 * * Move recommending into this, it has no need for it's own module.
 * * Get the selectors up to date with BEM
 * * Move over to $ instead of qwery & bonzo
 * @constructor
 * @extends Component
 * @param {Element=} context
 * @param {Object} mediator
 * @param {Object=} options
 */
var Comments = function(context, mediator, options) {
    this.context = context || document;
    this.mediator = mediator;
    this.setOptions(options);
};
Component.define(Comments);

/**
 * @type {Object.<string.*>}
 * @override
 */
Comments.prototype.classes = {
    comments: 'd-thread--top-level',
    topLevelComment: 'd-comment--top-level',
    showMore: 'js-show-more-comments',
    reply: 'd-comment--response',
    showReplies: 'js-show-more-replies',
    header: 'd-discussion__header',

    comment: 'd-comment',
    commentActions: 'd-comment__actions__main',
    commentReply: 'd-comment__action--reply',
    commentPick: 'd-comment__pick',
    commentRecommend: 'd-comment__recommend'
};

/**
 * @type {string}
 * @override
 */
Comments.prototype.endpoint = '/discussion:discussionId.json';

/** @type {Object.<string.*>} */
Comments.prototype.defaultOptions = {
    discussionId: null,
    initialShow: 10,
    showRepliesCount: 3,
    user: null
};

/** @type {Boolean} */
Comments.prototype.hasHiddenComments = false;

/** @type {number} */
Comments.prototype.currentPage = 1;

/** @type {NodeList=} */
Comments.prototype.comments = null;

/** @type {NodeList=} */
Comments.prototype.topLevelComments = null;

/** @type {Object=} */
Comments.prototype.user = null;

/** @override */
Comments.prototype.prerender = function() {
    var self = this;

    // Set the heading to the correct text
    var heading = qwery('#comments')[0],
        commentCount = self.elem.getAttribute('data-comment-count');

    heading.innerHTML += ' <span class="discussion__comment-count">('+ commentCount +')</span>';

    // Ease of use
    self.topLevelComments = qwery(self.getClass('topLevelComment'), self.elem);
    self.comments = qwery(self.getClass('comment'), self.elem);
    self.user = self.options.user;

    // Determine user staff status
    if (self.user && self.user.badge) {
        self.user.is_staff = self.user.badge.some(function (e) { // Returns true if any element in array satisfies function
            return e.name === "Staff";
        });
    }

};

/** @override */
Comments.prototype.ready = function() {
    var initialShow = this.options.initialShow,
        self = this;

    if (this.topLevelComments.length > 0) {
        // Hide excess topLevelComments
        qwery(this.getClass('topLevelComment'), this.elem).forEach(function(elem, i) {
            if (i >= initialShow) {
                self.hasHiddenComments = true;
                bonzo(elem).addClass('u-h');
            }
        });

        if (this.topLevelComments.length > initialShow) {
            if (!this.getElem('showMore')) {
                bonzo(this.getElem('comments')).append(
                    '<a class="js-show-more-comments cta" data-link-name="Show more comments" data-remove="true" href="/discussion'+
                        this.options.discussionId +'?page=1">'+
                        'Show more comments'+
                    '</a>');
            }
            this.on('click', this.getElem('showMore'), this.showMore);
        }

        this.hideExcessReplies();
        if (!this.isReadOnly()) {
            this.bindCommentEvents();
        }
        this.on('click', this.getClass('showReplies'), this.showMoreReplies);
    }
    this.emit('ready');
};

Comments.prototype.bindCommentEvents = function() {
    RecommendComments.init(this.context);

    if (this.user && this.user.privateFields.canPostComment) {
        this.renderPickButtons();
        this.on('click', this.getClass('commentReply'), this.replyToComment);
    }
};

/**
 * @param {NodeList} comments
 */
Comments.prototype.renderPickButtons = function (comments) {
    var actions,
        self        = this,
        buttonText  = "<div class='u-fauxlink d-comment__action d-comment__action--pick' 'role='button'></div>",
        sepText     = "<span class='d-comment__seperator d-comment__action'>|</span>";

    comments = comments || self.comments;

    if (self.user.is_staff) {
        comments.forEach(function (e) {
            if (e.getAttribute("data-comment-author-id") !== self.user.userId) {
                var button = bonzo(bonzo.create(buttonText))
                                .text(e.getAttribute("data-comment-highlighted") !== "true" ? "Pick" : "Un-Pick");
                button.data("thisComment", e);
                var sep = bonzo.create(sepText);
                $(self.getClass('commentActions'), e).append([sep[0],button[0]]);
                self.on('click', button, self.handlePickClick.bind(self));
            }
        });
    }
};

/**
 * @param {Event} event
 */
Comments.prototype.handlePickClick = function (event) {
    event.preventDefault();

    var thisComment = bonzo(event.target).data("thisComment"),
        $thisButton = $(event.target),
        promise = thisComment.getAttribute("data-comment-highlighted") === "true" ? this.unPickComment.bind(this) : this.pickComment.bind(this);

    promise(thisComment, $thisButton)
        .fail(function (resp) {
            var responseText = resp.response.length > 0 ? JSON.parse(resp.response).message : resp.statusText;
            $(event.target).text(responseText);
        });
};

/**
 * @param   {Element}      thisComment
 * @param   {Bonzo}    $thisButton
 * @return  {Reqwest}       AJAX Promise
 */
Comments.prototype.pickComment = function (thisComment, $thisButton) {
    var self = this;
    return DiscussionApi
        .pickComment(thisComment.getAttribute("data-comment-id"))
        .then(function () {
            $(self.getClass('commentPick'), thisComment).removeClass('u-h');
            $(self.getClass('commentRecommend'), thisComment).addClass("d-comment__recommend--left");
            $thisButton.text('Un-pick');
            thisComment.setAttribute("data-comment-highlighted", true);
        });
};

/**
 * @param   {Element}      thisComment
 * @param   {Bonzo}    $thisButton
 * @return  {Reqwest}       AJAX Promise
 */
Comments.prototype.unPickComment = function (thisComment, $thisButton) {
    var self = this;
    return DiscussionApi
        .unPickComment(thisComment.getAttribute("data-comment-id"))
        .then(function () {
            $(self.getClass('commentPick'), thisComment).addClass('u-h');
            $(self.getClass('commentRecommend'), thisComment).removeClass("d-comment__recommend--left");
            $thisButton.text('Pick');
            thisComment.setAttribute("data-comment-highlighted", false);
        });
};

/**
 * @param {Event} e
 */
Comments.prototype.showMore = function(event) {
    if (event) { event.preventDefault(); }

    var showMoreButton = this.getElem('showMore');

    if (showMoreButton.getAttribute('data-disabled') === 'disabled') {
        return;
    }

    if (this.hasHiddenComments) {
        this.showHiddenComments();
    } else {
        showMoreButton.innerHTML = 'Loading…';
        showMoreButton.setAttribute('data-disabled', 'disabled');
        ajax({
            url: '/discussion'+ this.options.discussionId +'.json?page='+ (this.currentPage+1),
            type: 'json',
            method: 'get',
            crossOrigin: true
        }).then(this.commentsLoaded.bind(this));
    }
};

Comments.prototype.showHiddenComments = function() {
    qwery(this.getClass('topLevelComment'), this.elem).forEach(function(elem, i) {
        bonzo(elem).removeClass('u-h');
    });
    this.hasHiddenComments = false;

    if (this.getElem('showMore').getAttribute('data-remove') === 'true') {
        bonzo(this.getElem('showMore')).remove();
    }
    this.emit('first-load');
};

/**
 * @param {Event}
 */
Comments.prototype.showMoreReplies = function(e) {
    bonzo(qwery(this.getClass('reply'), bonzo(e.currentTarget).parent()[0])).removeAttr('hidden');
    bonzo(e.currentTarget).remove();
};

/**
 * @param {Array.<Element>=} comments (optional)
 */
Comments.prototype.hideExcessReplies = function(comments) {
    var replies, repliesToHide,
        self = this;

    comments = comments || this.topLevelComments;
    comments.forEach(function(elem, i) {
        replies = qwery(self.getClass('reply'), elem);

        if (replies.length > self.options.showRepliesCount) {
            repliesToHide = replies.slice(self.options.showRepliesCount, replies.length);
            bonzo(repliesToHide).attr('hidden', 'hidden');

            bonzo(qwery('.d-thread--responses', elem)).append(
                '<li class="'+ self.getClass('showReplies', true) +' cta" data-link-name="Show more replies" data-is-ajax>Show '+
                    repliesToHide.length + ' more ' + (repliesToHide.length === 1 ? 'reply' : 'replies') +
                '</li>');
        }
    });
};

/**
 * @return {Boolean}
 */
Comments.prototype.isReadOnly = function() {
    return this.elem.getAttribute('data-read-only') === 'true';
};

/**
 * @param {Object} resp
 */
Comments.prototype.commentsLoaded = function(resp) {
    var comments = qwery(this.getClass('topLevelComment'), bonzo.create(resp.html)),
        showMoreButton = this.getElem('showMore');

    this.currentPage++;
    if (!resp.hasMore) {
        this.removeShowMoreButton();
    }

    if (!this.isReadOnly()) {
        this.renderPickButtons(qwery(this.getClass('comment'), bonzo(comments).parent()));
    }

    bonzo(this.getElem('comments')).append(comments);

    showMoreButton.innerHTML = 'Show more';
    showMoreButton.removeAttribute('data-disabled');

    this.hideExcessReplies(comments);

    if (!this.isReadOnly()) {
        RecommendComments.init(this.context);

    }
    this.emit('loaded');
};

Comments.prototype.removeShowMoreButton = function() {
    bonzo(this.getElem('showMore')).remove();
};

/**
 * @param {object.<string.*>} comment
 * @param {Boolean=} focus (optional)
 * @param {Element=} parent (optional)
 */
Comments.prototype.addComment = function(comment, focus, parent) {
    var key, val, selector, elem,
        attr,
        map = {
            username: 'd-comment__author',
            timestamp: 'js-timestamp',
            body: 'd-comment__body',
            report: 'd-comment__action--report',
            avatar: 'd-comment__avatar'
        },
        values = {
            username: this.user.displayName,
            timestamp: 'Just now',
            body: '<p>'+ comment.body.replace(/\n+/g, '</p><p>') +'</p>',
            report: {
                href: 'http://discussion.theguardian.com/components/report-abuse/'+ comment.id
            },
            avatar: {
                src: this.user.avatar
            }
        },
        commentElem = bonzo.create(document.getElementById('tmpl-comment').innerHTML)[0];
        bonzo(commentElem).addClass('fade-in'); // Comments now appear with CSS Keyframe animation

    for (key in map) {
        if (map.hasOwnProperty(key)) {
            selector = map[key];
            val = values[key];
            elem = qwery('.'+ selector, commentElem)[0];
            if (typeof val === 'string') {
                elem.innerHTML = val;
            } else {
                for (attr in val) {
                    elem.setAttribute(attr, val[attr]);
                }
            }
        }
    }
    commentElem.id = 'comment-'+ comment.id;

    if (this.user.is_staff) {
        // Hack to allow staff badge to appear
        var staffBadge = bonzo.create(document.getElementById('tmpl-staff-badge').innerHTML);
        $('.d-comment__meta div', commentElem).first().append(staffBadge);
    }

    // Stupid hack. Will rearchitect.
    if (!parent) {
        bonzo(this.getElem('comments')).prepend(commentElem);
    } else {
        bonzo(parent).append(commentElem);
    }

    window.location.hash = '#_';
    if (focus) {
        window.location.hash = '#comment-'+ comment.id;
    }
};

/** @param {Event} e */
Comments.prototype.replyToComment = function(e) {
    var parentCommentEl, showRepliesElem,
        replyLink = e.currentTarget,
        replyToId = replyLink.getAttribute('data-comment-id'),
        self = this;

    // There is already a comment box for this on the page
    if (document.getElementById('reply-to-'+ replyToId)) {
        document.getElementById('reply-to-'+ replyToId).focus();
        return;
    }

    var replyToComment = qwery('#comment-'+ replyToId)[0],
        replyToAuthor = replyToComment.getAttribute('data-comment-author'),
        replyToAuthorId = replyToComment.getAttribute('data-comment-author-id'),
        $replyToComment = bonzo(replyToComment),
        commentBox = new CommentBox(this.context, this.mediator, {
            discussionId: this.options.discussionId,
            premod: this.user.privateFields.isPremoderated,
            state: 'response',
            replyTo: {
                commentId: replyToId,
                author: replyToAuthor,
                authorId: replyToAuthorId
            },
            focus: true,
            cancelable: true
        });

    // this is a bit toffee, but we don't have .parents() in bonzo
    parentCommentEl = $replyToComment.hasClass(this.getClass('topLevelComment', true)) ? $replyToComment[0] : $replyToComment.parent().parent()[0];

    // I don't like this, but UX says go
    showRepliesElem = qwery(this.getClass('showReplies'), parentCommentEl);
    if (showRepliesElem.length > 0) {
        showRepliesElem[0].click();
    }
    commentBox.render(parentCommentEl);

    // TODO (jamesgorrie): Remove Hack hack hack
    commentBox.on('post:success', function(comment) {
        var responses = qwery('.d-thread--responses', parentCommentEl)[0];
        if (!responses) {
            responses = bonzo.create('<ul class="d-thread d-thread--responses"></ul>')[0];
            bonzo(parentCommentEl).append(responses);
        }
        self.addComment(comment, false, responses);
        this.destroy();
    });
};

return Comments;


});
