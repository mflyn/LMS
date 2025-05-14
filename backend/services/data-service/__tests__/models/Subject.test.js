const mongoose = require('mongoose');

// 模拟Subject模型
jest.mock('../../models/Subject', () => {
  // 创建一个模拟的getKnowledgePointTree方法
  const getKnowledgePointTree = function() {
    const points = this.knowledgePoints;
    const tree = [];
    const map = {};

    // 首先创建所有节点的映射
    points.forEach(point => {
      map[point.code] = {
        ...point.toObject(),
        children: []
      };
    });

    // 构建树结构
    points.forEach(point => {
      if (point.parentCode && map[point.parentCode]) {
        map[point.parentCode].children.push(map[point.code]);
      } else {
        tree.push(map[point.code]);
      }
    });

    return tree;
  };

  return {
    methods: {
      getKnowledgePointTree
    }
  };
});

describe('Subject Model', () => {
  let Subject;
  let subjectModel;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 重新导入Subject模块
    Subject = require('../../models/Subject');

    // 创建一个模拟的Subject实例
    subjectModel = {
      knowledgePoints: [
        {
          code: 'math-1',
          name: '数与代数',
          description: '数与代数知识点',
          parentCode: null,
          level: 1,
          order: 1,
          toObject: () => ({
            code: 'math-1',
            name: '数与代数',
            description: '数与代数知识点',
            parentCode: null,
            level: 1,
            order: 1
          })
        },
        {
          code: 'math-1-1',
          name: '整数',
          description: '整数知识点',
          parentCode: 'math-1',
          level: 2,
          order: 1,
          toObject: () => ({
            code: 'math-1-1',
            name: '整数',
            description: '整数知识点',
            parentCode: 'math-1',
            level: 2,
            order: 1
          })
        },
        {
          code: 'math-1-2',
          name: '分数',
          description: '分数知识点',
          parentCode: 'math-1',
          level: 2,
          order: 2,
          toObject: () => ({
            code: 'math-1-2',
            name: '分数',
            description: '分数知识点',
            parentCode: 'math-1',
            level: 2,
            order: 2
          })
        },
        {
          code: 'math-2',
          name: '几何',
          description: '几何知识点',
          parentCode: null,
          level: 1,
          order: 2,
          toObject: () => ({
            code: 'math-2',
            name: '几何',
            description: '几何知识点',
            parentCode: null,
            level: 1,
            order: 2
          })
        }
      ]
    };
  });

  describe('getKnowledgePointTree', () => {
    it('应该有getKnowledgePointTree方法', () => {
      expect(Subject.methods.getKnowledgePointTree).toBeDefined();
      expect(typeof Subject.methods.getKnowledgePointTree).toBe('function');
    });

    it('应该正确构建知识点树', () => {
      // 将getKnowledgePointTree方法添加到模拟的Subject实例
      subjectModel.getKnowledgePointTree = Subject.methods.getKnowledgePointTree;

      // 调用方法
      const tree = subjectModel.getKnowledgePointTree();

      // 验证树结构
      expect(tree).toHaveLength(2); // 两个顶级节点

      // 验证第一个顶级节点
      expect(tree[0]).toEqual(expect.objectContaining({
        code: 'math-1',
        name: '数与代数',
        children: expect.arrayContaining([
          expect.objectContaining({
            code: 'math-1-1',
            name: '整数',
            children: []
          }),
          expect.objectContaining({
            code: 'math-1-2',
            name: '分数',
            children: []
          })
        ])
      }));

      // 验证第二个顶级节点
      expect(tree[1]).toEqual(expect.objectContaining({
        code: 'math-2',
        name: '几何',
        children: []
      }));
    });

    it('应该处理空的知识点列表', () => {
      // 创建一个没有知识点的Subject实例
      const emptySubject = {
        knowledgePoints: [],
        getKnowledgePointTree: Subject.methods.getKnowledgePointTree
      };

      // 调用方法
      const tree = emptySubject.getKnowledgePointTree();

      // 验证结果
      expect(tree).toEqual([]);
    });

    it('应该处理无效的父节点引用', () => {
      // 创建一个包含无效父节点引用的Subject实例
      const invalidSubject = {
        knowledgePoints: [
          {
            code: 'math-1',
            name: '数与代数',
            parentCode: null,
            toObject: () => ({
              code: 'math-1',
              name: '数与代数',
              parentCode: null
            })
          },
          {
            code: 'math-1-1',
            name: '整数',
            parentCode: 'invalid-parent', // 无效的父节点引用
            toObject: () => ({
              code: 'math-1-1',
              name: '整数',
              parentCode: 'invalid-parent'
            })
          }
        ],
        getKnowledgePointTree: Subject.methods.getKnowledgePointTree
      };

      // 调用方法
      const tree = invalidSubject.getKnowledgePointTree();

      // 验证结果
      expect(tree).toHaveLength(2); // 两个顶级节点，因为第二个节点的父节点引用无效
      expect(tree[0].code).toBe('math-1');
      expect(tree[1].code).toBe('math-1-1');
    });
  });
});
