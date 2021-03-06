// The onClicked callback function.
function onClickHandler(info, tab) {
  // http://stackoverflow.com/questions/8262266/xmlhttprequest-multipart-related-post-with-xml-and-image-as-payload
  function gen_multipart(metadata, image, mimetype, callback) {
    var before = [
      "Media multipart posting\n",
      '--END_OF_PART', "\n",
      metadata,
      '--END_OF_PART', "\n",
      'Content-Type:', mimetype, "\n\n"].join('');
    var b = new Blob([before, image, '\n--END_OF_PART--'])
    var reader = new FileReader();
    reader.addEventListener("loadend", function() {
      var buffer = reader.result;
      callback(buffer);
    });
    reader.readAsArrayBuffer(b);
  }

  function makeUploadMatadata(info, tab) {
    var summary = "タイトル : " + tab.title + "\n" +
        "画像URL : " + info.srcUrl + "\n" +
        "設置ページURL : " + info.pageUrl + "\n";
    summary = summary.replace(
        /["&'<>]/g,
        function( ch ) { return { '"':'&quot;', '&':'&amp;', '\'':'&#39;', '<':'&lt;', '>':'&gt;' }[ ch ]; }
    );
    var title = tab.title.replace(
        /["&'<>]/g,
        function( ch ) { return { '"':'&quot;', '&':'&amp;', '\'':'&#39;', '<':'&lt;', '>':'&gt;' }[ ch ]; }
    );
    return "Content-type: application/atom+xml\n\n" +
        "<entry xmlns='http://www.w3.org/2005/Atom'>\n" +
        "<title>" + title + "</title>\n" +
        "<summary>" + summary + "</summary>\n" +
        "<category scheme=\"http://schemas.google.com/g/2005#kind\"" +
        " term=\"http://schemas.google.com/photos/2007#photo\" />" +
        "</entry>\n";
  }

  //http://stackoverflow.com/questions/8262266/xmlhttprequest-multipart-related-post-with-xml-and-image-as-payload
  function upload_to_album(arrayBuffer, filetype, albumid, metadata) {
    gen_multipart(metadata, arrayBuffer, filetype, function (request) {
      var url = 'http://picasaweb.google.com/data/feed/api/user/default/albumid/' + albumid;
      chrome.identity.getAuthToken({'interactive': true}, function (token) {
        uploadAlbum(url, request, token, true);
      });
    });
  }

  function uploadAlbum(url, sendData, token, retry) {
    var method = 'POST';
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("Content-Type", 'multipart/related; boundary="END_OF_PART"');
    xhr.setRequestHeader("MIME-version", "1.0");
    xhr.setRequestHeader("GData-Version", '3.0');
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.onreadystatechange = function (data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 401 && retry) {
          // 認証失敗
          chrome.identity.removeCachedAuthToken(
              {"token": token},
              function () {
                chrome.identity.getAuthToken({'interactive': true}, function (token) {
                  uploadAlbum(url, sendData, token, false);
                })
              });
        } else if (xhr.status != 201) {
          // なんかエラー
          alert(xhr.status + "\n" + xhr.responseText);
        } else {
          // 正常終了
          // TODO アップロード正常終了時に通知をする
        }
      }
    };
    xhr.send(sendData);
  }

  function getImageToUpload(info, tab, albumid) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", info.srcUrl, true);
    xhr.responseType = "blob";

    xhr.onload = function (e) {
      if (this.status == 200) {
        var blob = this.response;
        var reader = new FileReader();
        reader.addEventListener("loadend", function () {
          upload_to_album(this.result, blob.type, albumid, makeUploadMatadata(info, tab));
        });
        reader.readAsArrayBuffer(blob);
      }
    };
    xhr.send();
  }

  function getAlbumId(info) {
    var menuId = info.menuItemId;
    if (menuId.substr(0, 3) === "gp_") {
      return menuId.substr(3);
    } else {
      throw new Error("Not Google Photos Menus?");
    }
  }

  if (info.menuItemId === "go_to_option") {
    //オプションへ飛ぶ
    goToOption(tab);
  } else {
    //アップロード処理
    getImageToUpload(info, tab, getAlbumId(info));
  }
}

chrome.contextMenus.onClicked.addListener(onClickHandler);

function goToOption(tab) {
  var url = chrome.extension.getURL("options.html");
  window.open(url);
}

function makeMenu() {
  // ToDo サブメニューの実装。どうやら11個までしか表示できないらしい。←バグかも
  var contexts = ["image"];
  var title = "Google Photosにアップロードするやつ";
  var parentId = "parent";
  chrome.contextMenus.create({
    "title": title,
    "contexts": contexts,
    "id": parentId
  });
  chrome.storage.local.get("menuList", function (data) {
    var i;
    var json = data['menuList'];

    if (json === void 0) {
      json = [];
      console.log("none data");
    }
    for (i = 0; i < json.length; i++) {
      if (json[i]['id'] === void 0) {
        //idがundefinedのとき == オプション画面
        chrome.contextMenus.create({
          "title": "オプション...",
          "id": "go_to_option",
          "contexts": contexts,
          "parentId": parentId
        });
      } else {
        if (json[i]['id'] !== '') {
            chrome.contextMenus.create({
                "title": json[i]["name"],
                "id": json[i]['id'],
                "contexts": contexts,
                "parentId": parentId
            });
        }
      }
    }
    if (json.length === 0) {
      console.log("json.length 0")
      chrome.contextMenus.create({
        "title": "default",
        "id": "gp_default",
        "contexts": contexts,
        "parentId": parentId
      });
    }
  });
}

function resetMenu () {
  chrome.contextMenus.removeAll(function () {
    makeMenu();
  });
}

chrome.runtime.onInstalled.addListener(function () {
  makeMenu();
  chrome.storage.onChanged.addListener(function () {
    resetMenu();
  });
});
