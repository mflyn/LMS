import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../src/contexts/AuthContext';
import api from '../../../src/services/api';

export default function ResourcesScreen() {
  const [resources, setResources] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    subject: '',
    grade: '',
    type: ''
  });
  const navigation = useNavigation();
  const { user } = useAuth();

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    setLoading(true);
    setError(null);
    try {
      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append('keyword', searchQuery);
      if (filters.subject) queryParams.append('subject', filters.subject);
      if (filters.grade) queryParams.append('grade', filters.grade);
      if (filters.type) queryParams.append('type', filters.type);
      
      const response = await api.get(`/resources?${queryParams.toString()}`);
      setResources(response.data);
    } catch (err) {
      console.error('获取资源列表失败', err);
      setError('获取资源列表失败，请稍后再试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchResources();
  };

  const handleSearch = () => {
    fetchResources();
  };

  const handleResourcePress = (resource) => {
    navigation.navigate('ResourceDetail', { resourceId: resource._id });
  };

  const renderResourceItem = ({ item }) => {
    return (
      <TouchableOpacity 
        style={styles.resourceItem} 
        onPress={() => handleResourcePress(item)}
      >
        <View style={styles.resourceHeader}>
          <Text style={styles.resourceSubject}>{item.subject}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{item.type}</Text>
          </View>
        </View>
        
        <Text style={styles.resourceTitle}>{item.title}</Text>
        <Text style={styles.resourceDescription} numberOfLines={2}>{item.description}</Text>
        
        <View style={styles.resourceFooter}>
          <View style={styles.statsContainer}>
            <Text style={styles.statItem}>
              <Ionicons name="eye-outline" size={14} color="#666" /> {item.viewCount || 0}
            </Text>
            <Text style={styles.statItem}>
              <Ionicons name="download-outline" size={14} color="#666" /> {item.downloadCount || 0}
            </Text>
            <Text style={styles.statItem}>
              <Ionicons name="star-outline" size={14} color="#666" /> {item.averageRating || 0}
            </Text>
          </View>
          
          <Text style={styles.uploadDate}>
            {new Date(item.uploadDate).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterChips = () => {
    const subjects = ['语文', '数学', '英语', '科学'];
    const grades = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
    const types = ['课件', '习题', '视频', '文档'];
    
    return (
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {subjects.map(subject => (
            <TouchableOpacity 
              key={`subject-${subject}`}
              style={[styles.filterChip, filters.subject === subject && styles.activeFilterChip]}
              onPress={() => {
                setFilters(prev => ({
                  ...prev,
                  subject: prev.subject === subject ? '' : subject
                }));
              }}
            >
              <Text style={[styles.filterChipText, filters.subject === subject && styles.activeFilterChipText]}>
                {subject}
              </Text>
            </TouchableOpacity>
          ))}
          
          {grades.map(grade => (
            <TouchableOpacity 
              key={`grade-${grade}`}
              style={[styles.filterChip, filters.grade === grade && styles.activeFilterChip]}
              onPress={() => {
                setFilters(prev => ({
                  ...prev,
                  grade: prev.grade === grade ? '' : grade
                }));
              }}
            >
              <Text style={[styles.filterChipText, filters.grade === grade && styles.activeFilterChipText]}>
                {grade}
              </Text>
            </TouchableOpacity>
          ))}
          
          {types.map(type => (
            <TouchableOpacity 
              key={`type-${type}`}
              style={[styles.filterChip, filters.type === type && styles.activeFilterChip]}
              onPress={() => {
                setFilters(prev => ({
                  ...prev,
                  type: prev.type === type ? '' : type
                }));
              }}
            >
              <Text style={[styles.filterChipText, filters.type === type && styles.activeFilterChipText]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>学习资源</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索资源"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>搜索</Text>
        </TouchableOpacity>
      </View>
      
      {renderFilterChips()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <Text>加载中...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchResources}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : resources.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>暂无资源</Text>
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  searchIcon: {
    marginRight: 5,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#1890ff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRadius: 4,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 5,
  },
  activeFilterChip: {
    backgroundColor: '#e6f7ff',
    borderWidth: 1,
    borderColor: '#1890ff',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterChipText: {
    color: '#1890ff',
  },
  listContainer: {
    padding: 10,
  },
  resourceItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resourceSubject: {
    fontSize: 14,
    color: '#666',
  },
  typeBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeText: {
    fontSize: 12,
    color: '#333',
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resourceDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  resourceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
  },
  statItem: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
  },
  uploadDate: {
    fontSize: 12,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4d4f',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#1890ff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    fontSize: 16,
  },
});