## Spring 排序工具

`JDK` 提供了 `java.util.Comparator` 接口用于对 `List` 或 `Array` 进行排序，开发者可以通过实现 `int compare(T o1, T o2)` 接口来指定集合的顺序。

```java
  Collections.sort(list, new Comparator<Integer>() {
    @Override
    public int compare(Integer o1, Integer o2) {
      // 如果o1小于o2，o1排序靠前
      return o1 - o2;
    }
  });
```

`Spring` 提供了 `OrderComparator` 为实现了 `Ordered` 接口的类的对象进行排序，`AnnotationAwareOrderComparator` 在 `OrderComparator`  的基础上增加了对使用 `@Order` 和 `@Priority` 注解的类的对象进行排序。优先级顺序为：实现 `Ordered` 接口 `>` `@Order` 注解 `>` `@Priority` 注解。

### OrderComparator

`OrderComparator` 实现了 `Comparator` 接口，其对 `compare` 方法的实现是调用自身的 `doCompare` 方法，如果其中某个对象实现了 `PriorityOrdered` 接口而另一个没有，则该对象排序靠前；否则调用 `getOrder` 方法获取顺序数值，数值小的排序靠前：

```java
	@Override
	public int compare(@Nullable Object o1, @Nullable Object o2) {
		return doCompare(o1, o2, null);
	}

	private int doCompare(@Nullable Object o1, @Nullable Object o2, @Nullable OrderSourceProvider sourceProvider) {
    // 实现了PriorityOrdered接口的对象优先级更高
		boolean p1 = (o1 instanceof PriorityOrdered);
		boolean p2 = (o2 instanceof PriorityOrdered);
		if (p1 && !p2) {
			return -1;
		}
		else if (p2 && !p1) {
			return 1;
		}

		int i1 = getOrder(o1, sourceProvider);
		int i2 = getOrder(o2, sourceProvider);
		return Integer.compare(i1, i2);
	}
```

在 `getOrder` 方法中提供了获取 `Order` 数值的拓展 `OrderSourceProvider`，可以通过其实现接口返回的 `orderSource` 来确定数值。如果没有传入拓展，在 `findOrder` 方法中会判断对象是否实现了 `Ordered` 接口，如果实现了此接口，则从实现的 `getOrder` 方法获取数值，否则默认指定为 `Integer` 的最大值。

```java
  private int getOrder(@Nullable Object obj, @Nullable OrderSourceProvider sourceProvider) {
    Integer order = null;
    if (obj != null && sourceProvider != null) {
      // 获取对象的orderSource
      Object orderSource = sourceProvider.getOrderSource(obj);
      if (orderSource != null) {
        if (orderSource.getClass().isArray()) {
          // orderSource是数组，获取第一个有效的order数值
          Object[] sources = ObjectUtils.toObjectArray(orderSource);
          for (Object source : sources) {
            order = findOrder(source);
            if (order != null) {
              break;
            }
          }
        }
        else {
          order = findOrder(orderSource);
        }
      }
    }
    return (order != null ? order : getOrder(obj));
  }
    
	protected int getOrder(@Nullable Object obj) {
		if (obj != null) {
			Integer order = findOrder(obj);
			if (order != null) {
				return order;
			}
		}
    // 没有指定order数值，默认指定为Integer.MAX_VALUE
		return Ordered.LOWEST_PRECEDENCE;
	}

	@Nullable
	protected Integer findOrder(Object obj) {
    // 对象如果实现了Ordered接口，从实现方法中取order数值
		return (obj instanceof Ordered ? ((Ordered) obj).getOrder() : null);
	}
```

因此 `OrderComparator` 可以对实现了 `Ordered` 接口的对象进行排序，对象通过 `getOrder` 方法返回的数值越小，排序越靠前。`OrderComparator` 提供了静态方法 `sort` 对 `Ordered` 接口的实现类集合做排序：

```java
  List<OrderedImpl> list = new ArrayList<>();
  OrderComparator.sort(list);
```

### AnnotationAwareOrderComparator

`AnnotationAwareOrderComparator` 继承了 `OrderComparator`，主要对 `findOrder` 方法进行了重写，根据对象类型的不同，获取排序数值的方式不同：

```java
	@Override
	@Nullable
	protected Integer findOrder(Object obj) {
		//通过Ordered接口获取排序
		Integer order = super.findOrder(obj);
		if (order != null) {
			return order;
		}

		if (obj instanceof Class) {
			// Class类型，分别从@Order和@Priority注解中获取排序
			return OrderUtils.getOrder((Class<?>) obj);
		}
		else if (obj instanceof Method) {
      // Method类型，从@Order注解中获取排序
			Order ann = AnnotationUtils.findAnnotation((Method) obj, Order.class);
			if (ann != null) {
				return ann.value();
			}
		}
		else if (obj instanceof AnnotatedElement) {
      // 实现了AnnotatedElement接口的对象，从@Order注解中获取排序
			Order ann = AnnotationUtils.getAnnotation((AnnotatedElement) obj, Order.class);
			if (ann != null) {
				return ann.value();
			}
		}
		else {
      // 分别从@Order和@Priority注解中获取排序
			order = OrderUtils.getOrder(obj.getClass());
			if (order == null && obj instanceof DecoratingProxy) {
        // 代理类使用原始类型中获取
				order = OrderUtils.getOrder(((DecoratingProxy) obj).getDecoratedClass());
			}
		}

		return order;
	}
```

如果是普通类型，会调用 `OrderUtils` 的 `getOrder` 方法获取排序数值，此方法会优先查看对象目标类是否含有 `@Order` 注解，标注了此注解，获取排序数值；否则查看 `Priority` 类是否被加载，如果已经成功加载并且类包含此注解，获取排序数值。

```java
	@Nullable
	public static Integer getOrder(Class<?> type) {
		Object cached = orderCache.get(type);
		if (cached != null) {
			return (cached instanceof Integer ? (Integer) cached : null);
		}
    // 获取@Order注解中的排序数值
		Order order = AnnotationUtils.findAnnotation(type, Order.class);
		Integer result;
		if (order != null) {
			result = order.value();
		}
		else {
      // 获取@Priority中获取排序数值
			result = getPriority(type);
		}
		orderCache.put(type, (result != null ? result : NOT_ANNOTATED));
		return result;
	}

	@Nullable
	private static Class<? extends Annotation> priorityAnnotationType;

	static {
		try {
      // 加载Priority注解类
			priorityAnnotationType = (Class<? extends Annotation>)
					ClassUtils.forName("javax.annotation.Priority", OrderUtils.class.getClassLoader());
		}
		catch (Throwable ex) {
			// javax.annotation.Priority not available
			priorityAnnotationType = null;
		}
	}

	@Nullable
	public static Integer getPriority(Class<?> type) {
		if (priorityAnnotationType == null) {
			return null;
		}
		Object cached = priorityCache.get(type);
		if (cached != null) {
			return (cached instanceof Integer ? (Integer) cached : null);
		}
    // 获取@Priority注解
		Annotation priority = AnnotationUtils.findAnnotation(type, priorityAnnotationType);
		Integer result = null;
		if (priority != null) {
			result = (Integer) AnnotationUtils.getValue(priority);
		}
		priorityCache.put(type, (result != null ? result : NOT_ANNOTATED));
		return result;
	}
```























