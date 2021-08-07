/*
 * use none (except for those as parameters)
 * written by Mzero for MikoSite(Front End), MIT License
 * can be included in a div and appendNavList.
 * for details see the code
 */
function navBar(navbarBox, opts) {
    // parse parameters ===================//
    if (typeof navbarBox == "string") navbarBox = document.querySelector(navbarBox);
    if (typeof opts == "undefined") opts = {};
    var title = ("title" in opts) ? opts.title : '';
    var titleColor = ("titleColor" in opts) ? 'color:' + opts.titleColor + ';' : 'color:#233;';
    var minItemWidth = ("minItemWidth" in opts) ? 'min-width:' + opts.minItemWidth + ';' : '';
    var navHeadImg = ("imageSrc" in opts) ? '<img src="' + opts.imageSrc
        + '" style="border-radius:6px;width:1.2em;height:1.2em;padding:0 0.2em">' : '';

    // init html and css ===================//
    { // navbarStyle
        var navbarStyle = '\
            .navbar {background-color:#ffffff; box-shadow:6px 0px 6px #ddd;}                     \
            .navHead {float:left;text-align:center;font-size:30px;padding:8px 24px;}             \
            .navMenu {display: none; float: left; cursor: pointer; }                             \
            .navTitle {margin:auto;font-weight:700;display:inline-block;text-decoration:none;}   \
            .navList {display: block; text-align: right; padding: 8px; }                         \
            .navList .item {cursor:pointer;display:inline-block;text-decoration:none;            \
                padding: 8px;font-size:16px;font-weight:600;text-align:center; }                        \
            .navList .item:hover {background-color:#aaa; color:#fff !important;}                 \
            .navList.sub { display: none; background: #f9f9f9; }                                 \
            @media screen and (max-width: 600px) {                                                      \
            .navHead {float:none;}  .navMenu {display:inline-block;}                      \
            .navList {float:none;display:none;text-align:left;border-top:2px inset #dddddd;}     \
            .navList .item {display:block;text-align:left;}}';
    }
    { //navbarHtml
        var menuIcon = '<div style="padding:0.15em 0.1em;box-sizing:content-box;">'
            + '<div style="height:0.14em;width:0.8em;box-sizing:content-box;'
            + 'border-top:0.14em solid #555;"></div>'
            + '<div style="height:0.14em;width:0.8em;box-sizing:content-box;'
            + 'border-bottom:0.14em solid #555;border-top:0.14em solid #555;"></div></div>';
        var navbarHtml = '<div class="navbar">'
            + '<div class="navHead"><a class="navMenu">' + menuIcon + '</a><a class="navTitle"'
            + 'href="#" style="' + titleColor + '">' + navHeadImg + title + '</a></div>'
            + '<div class="mainList"></div><div class="subList"></div></div>';
    }
    insertStyleHtml(navbarStyle, navbarHtml, navbarBox);

    // local vars =========================//
    var navbar = navbarBox.querySelector('.navbar');
    var navMenu = navbar.querySelector('.navMenu');
    var mainList = navbar.querySelector('.mainList');
    var subList = navbar.querySelector('.subList');

    // additional Events and Actions ======//
    navMenu.onclick = function () { hideNavList('.navList.main'); hideNavList('.navList.sub', true); };

    // local functions ====================//
    function hideNavList(Selector, hide) {

        function hideListCore(navList, hide) {
            if (hide == "rev") navList.style.display = navList.style.display ? "" : "block";
            else if (hide) navList.style.display = "";
            else navList.style.display = "block";
        }

        if (typeof hide == "undefined") hide = "rev";
        var mainLists = mainList.querySelectorAll(Selector);
        var subLists = subList.querySelectorAll(Selector);
        var mainLength = mainLists.length, subLength = subLists.length;
        if (mainLength)
            for (var i = 0; i < mainLength; i++) hideListCore(mainLists[i], hide);
        if (subLength)
            for (var i = 0; i < subLength; i++) hideListCore(subLists[i], hide);
    }

    function genNavlist(isSub, members, color, name) {
        // members: [{text,idName,className,clickAct,minWidth}]
        if (typeof members == "undefined") members = [{}];
        var memberLength = members.length, memberList = [];
        var name = (typeof name == "undefined") ? '' : name;
        var color = (typeof color == "undefined") ? '' : 'color:' + color + ';';

        for (var i = 0; i < memberLength; i++) {
            var mem = members[i], text, idName, className, inMinWidth;
            text = ("text" in mem) ? mem.text : "";
            idName = ("idName" in mem) ? mem.idName : "";
            className = ("className" in mem) ? mem.className : "";
            clickAct = ("clickAct" in mem) ? 'onclick="' + mem.clickAct + '" ' : '';
            inMinWidth = ("minWidth" in mem) ? 'min-width:' + mem.minWidth + ';' : minItemWidth;
            memberList.push('<a class="item ' + className + '" id="' + idName + '" '
                + clickAct + 'style="' + color + inMinWidth + '" >' + text + '</a>');
        }

        if (isSub)
            return '<div class="navList sub ' + name + '">\n' + memberList.join('\n') + '\n</div>';
        else
            return '<div class="navList main">\n' + memberList.join('\n') + '\n</div>';
    }

    // methods ============================//
    this.hideNavList = hideNavList;
    this.queryItem = function (Selector) {
        var item = mainList.querySelector(Selector);
        if (!item) item = subList.querySelector(Selector);
        return item;
    }
    this.appendNavList = function (isSub, members, color, name) {
        // members: [{text,idName,className,minWidth}]
        if (isSub) subList.innerHTML += genNavlist(true, members, color, name);
        else mainList.innerHTML += genNavlist(false, members, color, name);
    }
}
