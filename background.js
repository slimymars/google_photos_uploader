// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// The onClicked callback function.
function onClickHandler(info, tab) {
  // http://stackoverflow.com/questions/8262266/xmlhttprequest-multipart-related-post-with-xml-and-image-as-payload
  function gen_multipart(metadata, image, mimetype) {
    image = new Uint8Array(image); // Wrap in view to get data

    var before = [
      "Media multipart posting\n",
      '--END_OF_PART', "\n",
      metadata,
      '--END_OF_PART', "\n",
      'Content-Type:', mimetype, "\n\n"].join('');
    var after = '\n--END_OF_PART--';
    var size = before.length + image.byteLength + after.length;
    var uint8array = new Uint8Array(size);
    var i = 0;

    // Append the string.
    for (; i<before.length; i++) {
        uint8array[i] = before.charCodeAt(i) & 0xff;
    }

    // Append the binary data.
    for (var j=0; j<image.byteLength; i++, j++) {
        uint8array[i] = image[j];
    }

    // Append the remaining string
    for (var j=0; j<after.length; i++, j++) {
        uint8array[i] = after.charCodeAt(j) & 0xff;
    }
    return uint8array.buffer; // <-- This is an ArrayBuffer object!
  }

  function makeUploadMatadata(info, tab) {
    summary = "PageUrl:" + info.pageUrl + "\n" +
          "SrcUrl:" + info.srcUrl + "\n" +
          "title:" + tab.title;
    result =
      "Content-type: application/atom+xml\n\n" +
      "<entry xmlns='http://www.w3.org/2005/Atom'>\n" +
      "<title>"+ info.srcUrl +"</title>\n" +
      "<summary>" + summary + "</summary>\n" +
      "<category scheme=\"http://schemas.google.com/g/2005#kind\"" +
      " term=\"http://schemas.google.com/photos/2007#photo\"\n/>" +
      "</entry>\n"
    return result;
  };

  //http://stackoverflow.com/questions/8262266/xmlhttprequest-multipart-related-post-with-xml-and-image-as-payload
  function upload_to_album(binaryString, filetype, albumid, info, tab) {
    var method = 'POST';
    var url = 'http://picasaweb.google.com/data/feed/api/user/default/albumid/' + albumid;
    var request = gen_multipart(makeUploadMatadata(info,tab), binaryString, filetype);
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("GData-Version", '3.0');
    xhr.setRequestHeader("Content-Type",  'multipart/related; boundary="END_OF_PART"');
    xhr.setRequestHeader("MIME-version", "1.0");
    // Add OAuth Token
    xhr.setRequestHeader("Authorization", oauth.getAuthorizationHeader(url, method, ''));
    xhr.onreadystatechange = function(data) {
        if (xhr.readyState == 4) {
            // .. handle response
        }
    };
    xhr.send(request);
  }
  console.log("item " + info.menuItemId + " was clicked");
  alert(makeUploadMatadata(info, tab));

};

chrome.contextMenus.onClicked.addListener(onClickHandler);

chrome.runtime.onInstalled.addListener(function() {
  var contexts = ["image"];
  for (var i = 0; i < contexts.length; i++) {
    var context = contexts[i];
    var title = "Test '" + context + "' menu item";
    var id = chrome.contextMenus.create({"title": title, "contexts":[context],
                                         "id": "context" + context});
  }
});
