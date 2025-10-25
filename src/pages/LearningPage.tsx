import { useState } from 'react'
import { Button } from '../components/ui/button'
import { BookOpen, Code2, Globe, Brain } from 'lucide-react'

const courses = [
  {
    category: 'Languages',
    icon: Globe,
    courses: ['Spanish', 'French', 'Japanese', 'German']
  },
  {
    category: 'Programming',
    icon: Code2,
    courses: ['JavaScript', 'Python', 'Web Development', 'AI & Machine Learning']
  },
  {
    category: 'Skills',
    icon: Brain,
    courses: ['Mathematics', 'Science', 'Business', 'Creative Writing']
  },
]

export default function LearningPage() {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <h2 className="text-2xl font-bold mb-2">🎓 AI Learning Center</h2>
        <p className="text-muted-foreground">Interactive courses powered by AI tutors</p>
      </div>

      {/* Courses Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(category => {
            const Icon = category.icon
            return (
              <div key={category.category} className="border border-border rounded-lg p-6 bg-card hover:bg-accent/50 transition">
                <div className="flex items-center gap-3 mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                  <h3 className="text-lg font-semibold">{category.category}</h3>
                </div>
                
                <div className="space-y-2">
                  {category.courses.map(course => (
                    <Button
                      key={course}
                      variant={selectedCourse === course ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => setSelectedCourse(course)}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      {course}
                    </Button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {selectedCourse && (
          <div className="mt-8 p-6 border border-border rounded-lg bg-card">
            <h3 className="text-xl font-bold mb-4">Learning: {selectedCourse}</h3>
            <p className="text-muted-foreground mb-4">
              Start your interactive lesson with an AI tutor. You can ask questions, practice exercises, and get personalized feedback.
            </p>
            <Button className="gap-2">
              <BookOpen className="w-4 h-4" />
              Start Lesson
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
