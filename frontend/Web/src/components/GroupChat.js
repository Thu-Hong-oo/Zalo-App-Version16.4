"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Video, Search, Menu, Send, Smile, Mic, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import api from "../config/api";

export default function GroupChat() {
  const { groupId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [groupDetails, setGroupDetails] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [groupDetails]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/chat/groups/${groupId}`);
      if (response.data.status === 'success' && response.data.data) {
        setGroupDetails(response.data.data);
      } else {
        throw new Error("Không thể tải thông tin nhóm");
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createSystemMessage = (details) => {
    if (!details?.members || details.members.length === 0) return null;
    const creator = details.members.find((m) => m.userId === details.createdBy);
    const creatorName = creator?.name || "Người tạo";
    const otherMemberNames = details.members
      .filter((m) => m.userId !== details.createdBy)
      .slice(0, 2)
      .map((m) => m.name || "Thành viên");
    let displayText = creatorName;
    if (otherMemberNames.length > 0) {
      displayText += `, ${otherMemberNames.join(", ")}`;
    }
    const displayUserIds = [
      creator?.userId,
      ...details.members
        .filter((m) => m.userId !== details.createdBy)
        .slice(0, 2)
        .map((m) => m.userId),
    ].filter(Boolean);
    const memberAvatars = details.members
      .filter((m) => displayUserIds.includes(m.userId))
      .map((m) => m.avatar || "/placeholder.svg");

    return {
      id: `system-${details.groupId}`,
      type: "system",
      text: `${displayText} đã tham gia nhóm`,
      memberNames: displayText,
      memberAvatars,
      timestamp: new Date(details.createdAt),
    };
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")} Hôm nay`;
  };

  const sendMessage = async () => {
    if (message.trim() === "") return;
    try {
      const response = await api.post(`/chat/groups/${groupId}/messages`, {
        content: message.trim(),
      });
      if (response.data.status === 'success') {
        setMessage("");
        // Refresh messages or update UI
      }
    } catch (err) {
      toast.error("Không thể gửi tin nhắn");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#E8EEF7]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0088FF]"></div>
      </div>
    );
  }

  if (error || !groupDetails) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-[#E8EEF7]">
        <p className="text-red-500">{error || "Không tìm thấy thông tin nhóm"}</p>
        <Button onClick={() => navigate(-1)} className="mt-4 bg-[#0088FF] hover:bg-[#0077E6]">
          Quay lại
        </Button>
      </div>
    );
  }

  const systemMessage = createSystemMessage(groupDetails);
  const messages = systemMessage ? [systemMessage] : [];

  return (
    <div className="flex flex-col h-screen bg-[#E8EEF7]">
      {/* Header */}
      <div className="flex items-center p-4 bg-[#0088FF] text-white">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-white">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="flex-1 ml-2">
          <h2 className="text-lg font-bold">{groupDetails.name}</h2>
          <p className="text-sm opacity-80">
            {groupDetails.members?.length || state?.memberCount} thành viên
          </p>
        </div>
        <Button variant="ghost" className="text-white">
          <Video className="h-6 w-6" />
        </Button>
        <Button variant="ghost" className="text-white">
          <Search className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          className="text-white"
          onClick={() => navigate(`/app/group/${groupId}/settings`)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Group Info Card */}
        <div className="bg-white rounded-lg p-4 text-center">
          <div className="flex justify-center mb-4 relative">
            {groupDetails.members?.[0] && (
              <Avatar className="h-12 w-12 z-20">
                <AvatarImage src={groupDetails.members[0].avatar || "/placeholder.svg"} />
                <AvatarFallback>{groupDetails.members[0].name[0]}</AvatarFallback>
              </Avatar>
            )}
            {groupDetails.members?.[1] && (
              <Avatar className="h-12 w-12 z-10 -ml-4">
                <AvatarImage src={groupDetails.members[1].avatar || "/placeholder.svg"} />
                <AvatarFallback>{groupDetails.members[1].name[0]}</AvatarFallback>
              </Avatar>
            )}
            <Avatar className="h-6 w-6 absolute bottom-0 right-0 z-30 bg-white">
              <AvatarImage src={groupDetails.avatar || "/placeholder.svg"} />
              <AvatarFallback>G</AvatarFallback>
            </Avatar>
          </div>
          <h3 className="text-lg font-bold">{groupDetails.name}</h3>
          <p className="text-sm text-gray-600">
            Bắt đầu chia sẻ những câu chuyện thú vị cùng nhau
          </p>
        </div>

        {/* Time Indicator */}
        <div className="text-center">
          <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
            {formatTime(groupDetails.createdAt)}
          </span>
        </div>

        {/* System Message */}
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-center bg-white rounded-full p-2">
            <div className="flex -space-x-2 mr-2">
              {msg.memberAvatars.map((avatar, index) => (
                <Avatar key={index} className="h-6 w-6 border-2 border-white">
                  <AvatarImage src={avatar} />
                  <AvatarFallback>M</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="text-sm">
              <span className="font-bold">{msg.memberNames}</span> đã tham gia nhóm
            </p>
          </div>
        ))}
      </div>

      {/* Message Input */}
      <div className="p-4 bg-white border-t">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" className="text-gray-600">
            <Smile className="h-6 w-6" />
          </Button>
          <Input
            className="flex-1 rounded-full bg-gray-100"
            placeholder="Tin nhắn"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          />
          <Button variant="ghost" className="text-gray-600">
            <Mic className="h-6 w-6" />
          </Button>
          <Button variant="ghost" className="text-gray-600">
            <Image className="h-6 w-6" />
          </Button>
          <Button onClick={sendMessage} className="bg-[#0088FF] hover:bg-[#0077E6]">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}