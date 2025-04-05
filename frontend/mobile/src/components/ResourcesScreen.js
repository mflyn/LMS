import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Searchbar, ActivityIndicator } from 'react-native-paper';
import { Rating } from 'react-native-ratings';
import apiService from '../services/api';

const ResourcesScreen = ({ navigation }) => {
  const [resources, setResources] = useState([]);
  const [recommendedResources, setRecommendedResources] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    subject: null,
    grade: null,
    type: null
  });

  // 学科列表
  const subjects = ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合'];
  
  // 年级列表
  const grades = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
  
  // 资源类型列表
  const resourceTypes = ['教案', '课件', '习题', '视频', '音频', '图片', '文档', '其他'];

  // 获取资源列表
  const fetchResources = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 构建查询参数
      const params = {};
      if (activeFilters.subject) params.subject = activeFilters.subject;
      if (activeFilters.grade) params.grade = activeFilters.grade;
      if (activeFilters.type) params.type = activeFilters.type;
      if (searchQuery) params.search = searchQuery;
      
      // 获取资源列表
      const resourcesResponse = await apiService.resources.getAll(params);
      setResources(resourcesResponse.data);
      
      // 获取推荐资源
      const recommendedResponse = await apiService.resources.getRecommended(params);
      setRecommendedResources(recommendedResponse.data);
    } catch (err) {
      setError('获取资源失败');
      console.error('获取资源失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 下拉刷新
  const onRefresh = () => {
    setRefreshing(true);
    fetchResources();
  };

  // 查看资源详情
  const viewResourceDetail = (resourceId) => {
    navigation.navigate('ResourceDetail', { resourceId });
  };

  // 切换过滤器
  const toggleFilter = (filterType, value) => {
    setActiveFilters(prev => {
      // 如果已经选中，则取消选中
      if (prev[filterType] === value) {
        return { ...prev, [filterType]: null };
      }
      // 否则选中新值
      return { ...prev, [filterType]: value };
    });
  };

  // 清除所有过滤器
  const clearFilters = () => {
    setActiveFilters({
      subject: null,
      grade: null,
      type: null
    });
    setSearchQuery('');
  };

  // 当过滤器或搜索查询变化时，重新获取资源
  useEffect(() => {
    fetchResources();
  }, [activeFilters, searchQuery]);

  // 组件挂载时获取资源
  useEffect(() => {
    fetchResources();
  }, []);

  // 渲染资源项
  const renderResourceItem = ({ item }) => (
    <Card style={styles.resourceCard} onPress={() => viewResourceDetail(item._id)}>
      <Card.Content>
        <Title style={styles.resourceTitle}>{item.title}</Title>
        <View style={styles.resourceMeta}>
          <Chip style={styles.chip}>{item.subject}</Chip>
          <Chip style={styles.chip}>{item.grade}</Chip>
          <Chip style={styles.chip}>{item.type}</Chip>
        </View>
        <Paragraph style={styles.resourceDesc} numberOfLines={2}>{item.description}</Paragraph>
        <View style={styles.ratingContainer}>
          <Rating
            readonly
            startingValue={item.averageRating || 0}
            imageSize={16}
            style={styles.rating}
          />
          <Text style={styles.ratingText}>{item.averageRating ? item.averageRating.toFixed(1) : '暂无评分'}</Text>
          <Text style={styles.downloadCount}>下载: {item.downloads}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  // 渲染推荐资源项
  const renderRecommendedItem = ({ item }) => (
    <Card style={styles.recommendedCard} onPress={() => viewResourceDetail(item._id)}>
      <Card.Content>
        <Title style={styles.resourceTitle}>{item.title}</Title>
        <Paragraph style={styles.resourceDesc} numberOfLines={1}>{item.description}</Paragraph>
        <View style={styles.ratingContainer}>
          <Rating
            readonly
            startingValue={item.averageRating || 0}
            imageSize={14}
            style={styles.rating}
          />
          <Text style={styles.ratingText}>{item.averageRating ? item.averageRating.toFixed(1) : '暂无评分'}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="搜索资源"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />
      
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          <Text style={styles.filterLabel}>学科:</Text>
          {subjects.map(subject => (
            <Chip
              key={subject}
              selected={activeFilters.subject === subject}
              onPress={() => toggleFilter('subject', subject)}
              style={[styles.filterChip, activeFilters.subject === subject && styles.activeChip]}
            >
              {subject}
            </Chip>
          ))}
          
          <Text style={[styles.filterLabel, { marginLeft: 16 }]}>年级:</Text>
          {grades.map(grade => (
            <Chip
              key={grade}
              selected={activeFilters.grade === grade}
              onPress={() => toggleFilter('grade', grade)}
              style={[styles.filterChip, activeFilters.grade === grade && styles.activeChip]}
            >
              {grade}
            </Chip>
          ))}
          
          <Text style={[styles.filterLabel, { marginLeft: 16 }]}>类型:</Text>
          {resourceTypes.map(type => (
            <Chip
              key={type}
              selected={activeFilters.type === type}
              onPress={() => toggleFilter('type', type)}
              style={[styles.filterChip, activeFilters.type === type && styles.activeChip]}
            >
              {type}
            </Chip>
          ))}
        </ScrollView>
        
        {(activeFilters.subject || activeFilters.grade || activeFilters.type || searchQuery) && (
          <Button mode="text" onPress={clearFilters} style={styles.clearButton}>
            清除筛选
          </Button>
        )}
      </View>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={fetchResources} style={styles.retryButton}>
            重试
          </Button>
        </View>
      )}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          data={resources}
          renderItem={renderResourceItem}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            recommendedResources.length > 0 ? (
              <View style={styles.recommendedSection}>
                <Title style={styles.sectionTitle}>推荐资源</Title>
                <FlatList
                  horizontal
                  data={recommendedResources}
                  renderItem={renderRecommendedItem}
                  keyExtractor={item => `recommended-${item._id}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recommendedList}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>暂无资源</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBar: {
    margin: 16,
    elevation: 2,
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filtersScroll: {
    paddingHorizontal: 16,
  },
  filterLabel: {
    alignSelf: 'center',
    marginRight: 8,
    fontWeight: 'bold',
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  activeChip: {
    backgroundColor: '#4a90e2',
  },
  clearButton: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginBottom: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  resourceCard: {
    marginBottom: 16,
    elevation: 2,
  },
  resourceTitle: {
    fontSize: 16,
  },
  resourceMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  resourceDesc: {
    marginVertical: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    alignItems: 'flex-start',
  },
  ratingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
  },
  downloadCount: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#666',
  },
  recommendedSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  recommendedList: {
    paddingRight: 16,
  },
  recommendedCard: {
    width: 200,
    marginRight: 12,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#F44336',
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
});

export default ResourcesScreen;