"use client"

import { useState, useRef, useEffect } from "react"
import { X, Camera, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar } from "@/components/ui/avatar"

export default function CreateGroupModal({ isOpen, onClose }) {
  const [groupName, setGroupName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedContacts, setSelectedContacts] = useState([])
  const modalRef = useRef(null)

  // Sample recent contacts data
  const recentContacts = [
    { id: "1", name: "Bé Vân lều khều", avatar: "/placeholder.svg?height=50&width=50" },
    { id: "2", name: "GD my mom 🥰 🥰 🥰", avatar: "/placeholder.svg?height=50&width=50" },
    { id: "3", name: "Minh Kha", avatar: "/placeholder.svg?height=50&width=50" },
    { id: "4", name: "Nguyễn Văn Đạt", avatar: "/placeholder.svg?height=50&width=50" },
    { id: "5", name: "Lê Minh Khánh", avatar: "/placeholder.svg?height=50&width=50" },
  ]

  const categories = [
    { id: "all", name: "Tất cả" },
    { id: "customers", name: "Khách hàng" },
    { id: "family", name: "Gia đình" },
    { id: "work", name: "Công việc" },
    { id: "friends", name: "Bạn bè" },
    { id: "later", name: "Trả lời sau" },
  ]

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle contact selection
  const toggleContactSelection = (contactId) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId],
    )
  }

  // Handle create group
  const handleCreateGroup = () => {
    // Here you would implement the logic to create the group
    console.log("Creating group:", {
      name: groupName,
      members: selectedContacts,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white rounded-lg w-full max-w-md flex flex-col h-[90vh] max-h-[600px] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Tạo nhóm</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Group info */}
        <div className="p-4 flex items-center space-x-4 border-b">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
              <Camera className="h-6 w-6 text-gray-500" />
            </div>
          </div>
          <Input
            className="flex-1 text-lg border-b border-t-0 border-l-0 border-r-0 rounded-none focus-visible:ring-0 px-0"
            placeholder="Nhập tên nhóm..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              className="pl-10 rounded-full bg-gray-100"
              placeholder="Nhập tên, số điện thoại, hoặc danh sách số điện thoại"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 flex space-x-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category.id}
              className={`px-4 py-2 rounded-full whitespace-nowrap ${
                selectedCategory === category.id ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
              }`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Recent conversations */}
        <div className="flex-1 overflow-y-auto p-4 border-t">
          <h3 className="text-lg font-bold mb-2">Trò chuyện gần đây</h3>
          <div className="space-y-2">
            {recentContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center space-x-3 py-2"
                onClick={() => toggleContactSelection(contact.id)}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded-full border-2"
                  checked={selectedContacts.includes(contact.id)}
                  onChange={() => {}}
                />
                <div className="flex items-center space-x-3 flex-1">
                  {contact.id === "5" ? (
                    <div className="h-12 w-12 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold">
                      LK
                    </div>
                  ) : (
                    <Avatar className="h-12 w-12">
                      <img src={contact.avatar || "/placeholder.svg"} alt={contact.name} className="object-cover" />
                    </Avatar>
                  )}
                  <span className="font-medium">{contact.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose} className="px-8">
            Hủy
          </Button>
          <Button
            onClick={handleCreateGroup}
            className="px-8 bg-blue-500 hover:bg-blue-600"
            disabled={!groupName || selectedContacts.length === 0}
          >
            Tạo nhóm
          </Button>
        </div>
      </div>
    </div>
  )
}
