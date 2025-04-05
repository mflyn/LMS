const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * 班级模型
 * 用于存储系统中的班级信息
 */
const classSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  grade: {
    type: Number,
    required: true,
    min: 1,
    max: 6
  },
  academicYear: {
    type: String,
    required: true,
    trim: true
  },
  headTeacher: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  students: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  subjects: [{
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject'
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    schedule: [{
      dayOfWeek: {
        type: Number,
        min: 1,
        max: 7
      },
      period: {
        type: Number,
        min: 1
      },
      duration: {
        type: Number,
        default: 40,
        min: 30
      },
      classroom: {
        type: String,
        trim: true
      }
    }]
  }],
  capacity: {
    type: Number,
    default: 50,
    min: 1
  },
  description: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 创建索引
classSchema.index({ name: 1, academicYear: 1 }, { unique: true });
classSchema.index({ grade: 1 });
classSchema.index({ headTeacher: 1 });

// 添加静态方法获取特定年级的所有班级
classSchema.statics.findByGrade = function(grade) {
  return this.find({ grade });
};

// 添加静态方法获取特定教师任教的所有班级
classSchema.statics.findByTeacher = function(teacherId) {
  return this.find({
    $or: [
      { headTeacher: teacherId },
      { 'subjects.teacher': teacherId }
    ]
  });
};

// 添加静态方法获取班级的学生数量
classSchema.statics.getStudentCount = async function(classId) {
  const classObj = await this.findById(classId);
  return classObj ? classObj.students.length : 0;
};

// 添加方法获取班级的课程表
classSchema.methods.getSchedule = function() {
  const schedule = Array(7).fill().map(() => Array(12).fill(null));
  
  this.subjects.forEach(subject => {
    subject.schedule.forEach(slot => {
      const dayIndex = slot.dayOfWeek - 1;
      const periodIndex = slot.period - 1;
      
      if (dayIndex >= 0 && dayIndex < 7 && periodIndex >= 0 && periodIndex < 12) {
        schedule[dayIndex][periodIndex] = {
          subject: subject.subject,
          teacher: subject.teacher,
          classroom: slot.classroom,
          duration: slot.duration
        };
      }
    });
  });
  
  return schedule;
};

const Class = mongoose.model('Class', classSchema);

module.exports = Class;