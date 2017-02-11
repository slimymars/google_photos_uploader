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
  function upload_to_album(arrayBuffer, filetype, albumid, metadata) {
    var request = gen_multipart(metadata, arrayBuffer, filetype);
    var url = 'http://picasaweb.google.com/data/feed/api/user/default/albumid/' + albumid;
    chrome.identity.getAuthToken({'interactive': true}, function (token) {
      uploadAlbum(url, request, token, true);
    });
  }

  function uploadAlbum(url, sendData, token, retry) {
    var method = 'POST';
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("Content-Type",  'multipart/related; boundary="END_OF_PART"');
    xhr.setRequestHeader("MIME-version", "1.0");
    xhr.setRequestHeader("GData-Version", '3.0');
    //xhr.setRequestHeader("Content-Length", request.length);
    // Add OAuth Token
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.onreadystatechange = function(data) {
        if (xhr.readyState == 4) {
          if (xhr.status == 401 && retry) {
            // 認証失敗
            chrome.identity.removeCachedAuthToken(
              {"token": token},
              function() {
                chrome.identity.getAuthToken({'interactive': true}, function (token) {
                  uploadAlbum(url, sendData, token, false);
                })
              });
          } else if (xhr.status != 201) {
            // なんかエラー
            alert(xhr.status + "\n" + xhr.responseText);
          }
        }
    };
    xhr.send(sendData);
  }

  function getImageToUpload(info, tab, albumid) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", info.srcUrl, true);
    xhr.responseType = "blob";

    xhr.onload = function(e) {
      if (this.status == 200) {
        var blob = this.response;
        var reader = new FileReader();
        reader.addEventListener("loadend", function(){
            upload_to_album(this.result, blob.type, albumid, makeUploadMatadata(info,tab));
        });
        reader.readAsArrayBuffer(blob);
      }
    };
    xhr.send();
  }

  getImageToUpload(info, tab, 'default');
};

chrome.contextMenus.onClicked.addListener(onClickHandler);

chrome.runtime.onInstalled.addListener(function() {
  var contexts = ["image"];
  var title = "Google Photosにアップロードするやつ";
  var parentId = "gp_parent"
  chrome.contextMenus.create({
    "title": title,
    "contexts":contexts,
    "id": parentId
  });
  chrome.contextMenus.create({
    "title": "default",
    "id": "gp_default",
    "contexts": contexts,
    "parentId": parentId
  });
});
