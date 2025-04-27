import { useState, useEffect } from "react";
import api from "../config/api";
import "./css/GroupMediaPanel.css";

export default function GroupMediaPanel({ groupId }) {
  const [media, setMedia] = useState({});
  const [docs, setDocs] = useState({});
  const [tab, setTab] = useState("media");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!groupId) return;
      setLoading(true);
      try {
        const { data } = await api.get(`/chat/media/${groupId}`);
        if (data.status === "success") {
          setMedia(data.data.media);
          setDocs(data.data.docs);
        }
      } catch {
        // TODO: error handling UI
      }
      setLoading(false);
    })();
  }, [groupId]);

  const dataByDate = tab === "media" ? media : docs;

  const getFriendlyFileType = (mime) => {
    if (!mime) return "Tệp";
    if (mime.includes("pdf")) return "PDF";
    if (mime.includes("msword")) return "Word";
    if (mime.includes("spreadsheet") || mime.includes("excel")) return "Excel";
    if (mime.includes("presentation")) return "PowerPoint";
    if (mime.includes("text/plain")) return "Text";
    return mime.split("/").pop();
  };

  const getFileIcon = (mime) => {
    if (!mime) return "💎";
    if (mime.includes("pdf")) return "💕";
    if (mime.includes("msword")) return "📄";
    if (mime.includes("spreadsheet") || mime.includes("excel")) return "📈";
    if (mime.includes("presentation")) return "📍";
    return "📆";
  };

  const getFileName = (url) => {
    try {
      const name = decodeURIComponent(url.split("/").pop());
      return name.length > 25 ? name.slice(0, 22) + "…" : name;
    } catch {
      return "file";
    }
  };

  return (
    <div className="media-panel">
      <div className="media-tabs">
        <button className={tab === "media" ? "active" : ""} onClick={() => setTab("media")}>Ảnh/Video</button>
        <button className={tab === "docs" ? "active" : ""} onClick={() => setTab("docs")}>Tài liệu/Link</button>
      </div>

      {loading && <p className="loading">Đang tải…</p>}

      {!loading && Object.keys(dataByDate).map(date => (
        <div key={date} className="media-group">
          <h4>{date}</h4>
          <div className="media-items">
            {dataByDate[date].map(m => (
              <div className="media-item" key={m.messageId}>
                {tab === "media" ? (
                  m.fileType?.startsWith("image/") ? (
                    <img src={m.content} alt="" />
                  ) : (
                    <video src={m.content} controls />
                  )
                ) : (
                  m.fileType ? (
                    <a href={m.content} target="_blank" rel="noreferrer" className="doc-item">
                        {getFileIcon(m.fileType)}
                        <div className="doc-text">
                            <span className="doc-name">{getFileName(m.content)}</span>
                            <span className="doc-ext">.{getFriendlyFileType(m.fileType)}</span>
                        </div>
                        </a>

                  ) : (
                    <a href={m.content} target="_blank" rel="noreferrer" className="doc-item">
                      🔗 Link
                    </a>
                  )
                )}
                <span className="timestamp">
                  {new Date(m.timestamp).toLocaleTimeString("vi-VN")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
